from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import os
import sys
import subprocess
import asyncio
import logging
from datetime import datetime

# Absolute path setup
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
frontend_dir = os.path.join(project_root, 'frontend')

sys.path.append(current_dir)

# Setup logging to file
logging.basicConfig(
    filename=os.path.join(project_root, 'server.log'),
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s'
)

def log_event(action, detail, result="Success"):
    msg = f"ACTION: {action} | DETAIL: {detail} | RESULT: {result}"
    print(f"LOGGING: {msg}")
    logging.info(msg)
    for handler in logging.root.handlers:
        handler.flush()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        log_event("WebSocket Connected", f"Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            log_event("WebSocket Disconnected", f"Total: {len(self.active_connections)}")

    async def send_command_to_displays(self, command: dict):
        count = len(self.active_connections)
        if count == 0:
            log_event("WebSocket Broadcast", f"Sending {command.get('action')} to 0 clients", "Failed")
            return 0

        success_count = 0
        for connection in self.active_connections:
            try:
                await connection.send_json(command)
                success_count += 1
            except Exception as e:
                log_event("WebSocket Error", str(e), "Error")
        
        log_event("WebSocket Broadcast", f"Sent {command.get('action')} to {success_count}/{count} clients", "Success")
        return success_count

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

TABLET_IP = "192.168.33.17:5555"
CURRENT_THEME = "day"

@app.get("/api/theme")
async def get_theme():
    return {"theme": CURRENT_THEME}

@app.post("/api/remote/command")
async def remote_command(cmd_data: dict):
    global CURRENT_THEME
    command = cmd_data.get("command")
    log_event("Remote Command Received", f"Command: {command}")
    
    subprocess.run(["adb", "connect", TABLET_IP], capture_output=True)

    try:
        if command == "toggle_screen":
            res = subprocess.run(["adb", "-s", TABLET_IP, "shell", "input", "keyevent", "26"], capture_output=True, text=True)
            return {"status": "success", "message": "Screen toggled"}

        if command == "toggle_theme":
            # 1. Switch the global theme state
            CURRENT_THEME = "night" if CURRENT_THEME == "day" else "day"
            
            # 2. Tell any connected device to change theme immediately (WS)
            await manager.send_command_to_displays({"action": "toggle_theme", "theme": CURRENT_THEME})
            
            log_event("Toggle Theme", f"Theme switched to {CURRENT_THEME} (WS Only)", "Success")
            return {"status": "success", "message": f"Theme toggled to {CURRENT_THEME}"}
        
        if command == "refresh":
            # 1. WS Refresh
            await manager.send_command_to_displays({"action": "refresh"})
            # 2. ADB Restart Browser (The most reliable way)
            browsers = ["com.android.chrome", "org.lineageos.jelly", "com.android.browser"]
            for b in browsers:
                subprocess.run(["adb", "-s", TABLET_IP, "shell", "am", "force-stop", b], capture_output=True)
            url = f"http://192.168.33.22:8000"
            subprocess.run(["adb", "-s", TABLET_IP, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url], capture_output=True)
            return {"status": "success", "message": "Refresh (Restart) Success"}

        if command == "play_sound":
            await manager.send_command_to_displays({"action": "play_sound"})
            return {"status": "success", "message": "Sound command sent"}
            
    except Exception as e:
        log_event("Error", str(e), "Exception")
        return {"status": "error", "message": str(e)}
    
    return {"status": "error", "message": f"Unknown command: {command}"}

from storage import save_completed_task, remove_completed_task

@app.get("/api/tasks")
async def get_tasks():
    try:
        from moodle_client import MoodleCalendarClient
        client = MoodleCalendarClient()
        events = client.fetch_events()
        log_event("Fetch Tasks", f"Retrieved {len(events)} events from Moodle")
        return {"status": "success", "tasks": events}
    except Exception as e:
        log_event("Fetch Tasks Error", str(e), "Failed")
        return {"status": "error", "message": str(e)}

@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str):
    save_completed_task(task_id)
    log_event("Task Completed", f"Task ID: {task_id}")
    await manager.send_command_to_displays({"action": "refresh"})
    return {"status": "success"}

@app.post("/api/tasks/{task_id}/incomplete")
async def incomplete_task(task_id: str):
    remove_completed_task(task_id)
    log_event("Task Undo", f"Task ID: {task_id}")
    await manager.send_command_to_displays({"action": "refresh"})
    return {"status": "success"}

@app.get("/control")
async def get_control():
    return FileResponse(os.path.join(frontend_dir, 'control.html'))

@app.get("/")
async def get_index():
    return FileResponse(os.path.join(frontend_dir, 'index.html'))

@app.get("/{filename}")
async def get_static(filename: str):
    file_path = os.path.join(frontend_dir, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return {"error": "Not Found"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
