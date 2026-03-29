import tkinter as tk
from tkinter import ttk
import requests
import threading
import time

SERVER_IP = "192.168.33.22"
API_URL = f"http://{SERVER_IP}:8000/api/tasks"

class TaskWidget:
    def __init__(self, root):
        self.root = root
        self.root.title("Moodle Tasks")
        self.root.geometry("300x400+1600+50") # Positioned at the top right
        self.root.overrideredirect(True) # Remove window borders
        self.root.attributes("-topmost", True) # Always on top
        self.root.attributes("-alpha", 0.9) # Slightly transparent
        self.root.configure(bg='#fdfdfa')

        # Custom Header (since we removed borders)
        self.header = tk.Frame(self.root, bg='#6a8d9d', cursor="fleur")
        self.header.pack(fill='x')
        self.header.bind("<ButtonPress-1>", self.start_move)
        self.header.bind("<ButtonRelease-1>", self.stop_move)
        self.header.bind("<B1-Motion>", self.do_move)

        self.title_label = tk.Label(self.header, text="הגשות Moodle", bg='#6a8d9d', fg='white', font=('Assistant', 10, 'bold'))
        self.title_label.pack(side='right', padx=10, py=5)

        self.close_btn = tk.Button(self.header, text="✕", bg='#6a8d9d', fg='white', bd=0, command=self.root.destroy)
        self.close_btn.pack(side='left', padx=5)

        # Tasks Container
        self.canvas = tk.Canvas(self.root, bg='#fdfdfa', highlightthickness=0)
        self.scroll_frame = tk.Frame(self.canvas, bg='#fdfdfa')
        self.canvas.pack(side="left", fill="both", expand=True)
        self.canvas.create_window((0, 0), window=self.scroll_frame, anchor="nw")

        self.update_tasks()

    def start_move(self, event): self.x = event.x; self.y = event.y
    def stop_move(self, event): self.x = None; self.y = None
    def do_move(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")

    def update_tasks(self):
        threading.Thread(target=self.fetch_tasks_thread, daemon=True).start()
        self.root.after(60000, self.update_tasks) # Auto-refresh every minute

    def fetch_tasks_thread(self):
        try:
            resp = requests.get(API_URL, timeout=5)
            data = resp.json()
            if data['status'] == 'success':
                self.root.after(0, lambda: self.render_tasks(data['tasks']))
        except Exception as e:
            self.root.after(0, lambda: self.show_error(str(e)))

    def render_tasks(self, tasks):
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        for task in tasks:
            if task['is_past'] and not task['is_completed']: continue
            
            frame = tk.Frame(self.scroll_frame, bg='white', bd=1, relief='groove', padx=5, py=5)
            frame.pack(fill='x', padx=5, py=2)

            color = '#4caf50' if task['is_completed'] else '#4a403a'
            title_font = ('Assistant', 9, 'overstrike' if task['is_completed'] else 'bold')

            lbl_course = tk.Label(frame, text=task['course'], bg='white', fg='#888', font=('Assistant', 7), anchor='e')
            lbl_course.pack(fill='x')

            lbl_title = tk.Label(frame, text=task['title'], bg='white', fg=color, font=title_font, anchor='e', wraplength=250)
            lbl_title.pack(fill='x')

            # Checkbox equivalent
            btn_text = "✓" if task['is_completed'] else "○"
            btn = tk.Button(frame, text=btn_text, font=('Assistant', 10), bd=0, bg='white', 
                           command=lambda t=task: self.toggle_task(t))
            btn.pack(side='left')

        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def toggle_task(self, task):
        endpoint = 'incomplete' if task['is_completed'] else 'complete'
        try:
            requests.post(f"http://{SERVER_IP}:8000/api/tasks/{task['id']}/{endpoint}")
            self.fetch_tasks_thread()
        except: pass

    def show_error(self, err):
        tk.Label(self.scroll_frame, text="שגיאה בחיבור לשרת", fg='red', bg='#fdfdfa').pack()

if __name__ == "__main__":
    root = tk.Tk()
    app = TaskWidget(root)
    root.mainloop()
