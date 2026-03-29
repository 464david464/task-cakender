import json
import os

COMPLETED_TASKS_FILE = "completed_tasks.json"

def get_completed_tasks():
    if not os.path.exists(COMPLETED_TASKS_FILE):
        return []
    try:
        with open(COMPLETED_TASKS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_completed_task(task_id):
    completed = get_completed_tasks()
    if task_id not in completed:
        completed.append(task_id)
        with open(COMPLETED_TASKS_FILE, "w") as f:
            json.dump(completed, f)
    return completed

def remove_completed_task(task_id):
    completed = get_completed_tasks()
    if task_id in completed:
        completed.remove(task_id)
        with open(COMPLETED_TASKS_FILE, "w") as f:
            json.dump(completed, f)
    return completed
