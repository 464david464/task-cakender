import requests
import os
import json
import base64
import re
from datetime import datetime, timezone
from icalendar import Calendar
import hashlib

MOODLE_URL = os.getenv("MOODLE_CALENDAR_URL")
GITHUB_TOKEN = os.getenv("GH_TOKEN")
REPO = "464david464/task-cakender"
FILE_PATH = "data.json"

def fetch_moodle_tasks():
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(MOODLE_URL, headers=headers, verify=False)
    if not resp.content.strip().startswith(b"BEGIN:VCALENDAR"): return []

    gcal = Calendar.from_ical(resp.content)
    events = []
    now = datetime.now(timezone.utc)

    for component in gcal.walk():
        if component.name == "VEVENT":
            summary = str(component.get('summary', ''))
            dtstart = component.get('dtstart').dt
            if not isinstance(dtstart, datetime):
                dtstart = datetime.combine(dtstart, datetime.min.time()).replace(tzinfo=timezone.utc)
            elif dtstart.tzinfo is None:
                dtstart = dtstart.replace(tzinfo=timezone.utc)

            # Course Name Extraction
            course_name = "כללי"
            categories = component.get('categories')
            if categories:
                cat_string = str(categories.cats[0])
                parts = cat_string.split(' - ')
                if len(parts) > 1: course_name = parts[1].strip()

            lower_s = summary.lower()
            assignment_keywords = ["יש להגיש", "is due", "מטלה", "תרגיל", "מבחן", "בוחן", "הגשת", "deadline", "task", "מכין", "מסכם", "תוצאות"]
            
            if any(kw in lower_s for kw in assignment_keywords):
                task_id = hashlib.md5(f"{summary}{dtstart.isoformat()}".encode()).hexdigest()
                
                clean_title = summary.replace("יש להגיש את '", "").replace("'", "").strip()
                
                # Special Logic for Geometric Optics B
                if "אופטיקה גיאומטרית ב" in course_name:
                    if "מכשור אופטי" not in summary:
                        clean_title = f"Zemax: {clean_title}"
                
                events.append({
                    "id": task_id,
                    "title": clean_title,
                    "course": course_name,
                    "due_date": dtstart.isoformat(),
                    "is_completed": False
                })
    events.sort(key=lambda x: x['due_date'])
    return events

def sync_to_github(new_tasks):
    branch = "main"
    url = f"https://api.github.com/repos/{REPO}/contents/{FILE_PATH}?ref={branch}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    
    resp = requests.get(url, headers=headers)
    sha = None
    if resp.status_code == 200:
        content = resp.json()
        sha = content['sha']
        existing = json.loads(base64.b64decode(content['content']).decode('utf-8'))
        
        status_map = {t['id']: (t.get('is_completed', False), t.get('completed_at')) for t in existing}
        for t in new_tasks:
            if t['id'] in status_map:
                is_done, timestamp = status_map[t['id']]
                t['is_completed'] = is_done
                if timestamp: t['completed_at'] = timestamp

    final_json = json.dumps(new_tasks, indent=2, ensure_ascii=False)
    payload = {
        "message": "Zemax Logic Update",
        "content": base64.b64encode(final_json.encode('utf-8')).decode('utf-8'),
        "sha": sha,
        "branch": branch
    }
    requests.put(f"https://api.github.com/repos/{REPO}/contents/{FILE_PATH}", headers=headers, json=payload)

if __name__ == "__main__":
    tasks = fetch_moodle_tasks()
    sync_to_github(tasks)
