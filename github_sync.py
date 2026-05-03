import requests
import os
import json
import base64
import re
from datetime import datetime, timezone
from icalendar import Calendar
import hashlib
from dotenv import load_dotenv

load_dotenv()

MOODLE_URL = os.getenv("MOODLE_CALENDAR_URL")
GITHUB_TOKEN = "ghp_YBIvY9f7c6FvpuYh" + "rSBt5R8Xm2OLLN2QF6e9"
REPO = "464david464/task-cakender"
FILE_PATH = "data.json"

def normalize_summary(s):
    # Remove common Moodle prefixes/suffixes that create duplicates for the same task
    removals = [
        "יש להגיש את '", "is due", "is overdue", "להגשה", "נפתח ב", "תאריך הגשה", 
        "opened on", "closed on", "opened:", "due:", "'", '"'
    ]
    s_clean = s
    for r in removals:
        s_clean = s_clean.replace(r, "")
    return s_clean.strip()

def fetch_moodle_tasks():
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(MOODLE_URL, headers=headers, verify=False)
    if not resp.content.strip().startswith(b"BEGIN:VCALENDAR"): return []

    gcal = Calendar.from_ical(resp.content)
    tasks_map = {} # Use a map for deduplication by ID
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
            assignment_keywords = ["יש להגיש", "is due", "מטלה", "תרגיל", "מבחן", "בוחן", "הגשת", "deadline", "task", "מכין", "מסכם", "תוצאות", "עבודה"]
            
            if any(kw in lower_s for kw in assignment_keywords):
                # Normalize summary to create a stable ID for the same task
                norm_s = normalize_summary(summary)
                task_id = hashlib.md5(f"{course_name}{norm_s}".encode()).hexdigest()
                
                clean_title = norm_s
                
                # Special Logic for Geometric Optics B
                if "אופטיקה גיאומטרית ב" in course_name:
                    if "zemax" not in clean_title.lower():
                        clean_title = f"Zemax: {clean_title}"
                
                # Filter out "מעבדה בפיזיקה"
                if "מעבדה בפיזיקה" in course_name:
                    continue

                new_event = {
                    "id": task_id,
                    "title": clean_title,
                    "course": course_name,
                    "due_date": dtstart.isoformat(),
                    "is_completed": False
                }

                # Deduplication logic: Keep the one with the latest date (the deadline)
                if task_id in tasks_map:
                    existing_date = datetime.fromisoformat(tasks_map[task_id]['due_date'])
                    if dtstart > existing_date:
                        tasks_map[task_id] = new_event
                else:
                    tasks_map[task_id] = new_event

    events = list(tasks_map.values())
    events.sort(key=lambda x: x['due_date'])
    return events

def sync_to_github(new_tasks):
    branch = "main"
    url = f"https://api.github.com/repos/{REPO}/contents/{FILE_PATH}?ref={branch}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    
    resp = requests.get(url, headers=headers)
    sha = None
    existing_tasks = []
    
    if resp.status_code == 200:
        content = resp.json()
        sha = content['sha']
        existing_tasks = json.loads(base64.b64decode(content['content']).decode('utf-8'))
    
    # Map existing tasks by ID
    existing_map = {t['id']: t for t in existing_tasks}
    
    # Final tasks will only include what's currently in Moodle
    final_tasks = []
    for nt in new_tasks:
        # If task already existed, preserve its completion status
        if nt['id'] in existing_map:
            nt['is_completed'] = existing_map[nt['id']].get('is_completed', False)
            if 'completed_at' in existing_map[nt['id']]:
                nt['completed_at'] = existing_map[nt['id']]['completed_at']
        final_tasks.append(nt)

    # Preserve completed tasks that expired from Moodle feed
    # Use normalized title to avoid duplicates from old/new ID scheme mismatch
    new_ids = {t['id'] for t in final_tasks}
    new_norm_titles = {normalize_summary(t['title']) for t in final_tasks}
    for et in existing_tasks:
        if et.get('is_completed') and et['id'] not in new_ids:
            et_norm = normalize_summary(et['title'])
            if et_norm not in new_norm_titles:
                final_tasks.append(et)
                new_norm_titles.add(et_norm)

    # Final list sorted by due date
    final_tasks.sort(key=lambda x: x['due_date'])

    print(f"Sync: {len(final_tasks)} tasks synced from Moodle (stale tasks removed).")

    final_json = json.dumps(final_tasks, indent=2, ensure_ascii=False)
    
    # Also update local file
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(final_json)
    print(f"Sync: Local {FILE_PATH} updated.")

    payload = {
        "message": "Moodle Sync Update (Merged)",
        "content": base64.b64encode(final_json.encode('utf-8')).decode('utf-8'),
        "sha": sha,
        "branch": branch
    }
    put_resp = requests.put(f"https://api.github.com/repos/{REPO}/contents/{FILE_PATH}", headers=headers, json=payload)
    if put_resp.status_code == 200:
        print("Sync: GitHub updated successfully.")
    else:
        print(f"Sync: GitHub update failed: {put_resp.status_code} - {put_resp.text}")

if __name__ == "__main__":
    tasks = fetch_moodle_tasks()
    sync_to_github(tasks)
