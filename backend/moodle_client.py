import requests
import os
import re
from datetime import datetime, timezone
from dotenv import load_dotenv
from icalendar import Calendar
import json
import hashlib
from storage import get_completed_tasks

load_dotenv()

class MoodleCalendarClient:
    def __init__(self, calendar_url=None):
        self.calendar_url = calendar_url or os.getenv("MOODLE_CALENDAR_URL")
        if not self.calendar_url:
            raise ValueError("Moodle Calendar URL is required.")

    def normalize_summary(self, s):
        # Remove common Moodle prefixes/suffixes that create duplicates for the same task
        removals = [
            "יש להגיש את '", "is due", "is overdue", "להגשה", "נפתח ב", "תאריך הגשה", 
            "opened on", "closed on", "opened:", "due:", "'", '"'
        ]
        s_clean = s
        for r in removals:
            s_clean = s_clean.replace(r, "")
        return s_clean.strip()

    def fetch_events(self):
        # Fetching the iCal file
        response = requests.get(self.calendar_url, verify=False)
        response.raise_for_status()
        
        gcal = Calendar.from_ical(response.content)
        tasks_map = {} # Use a map for deduplication
        completed_ids = get_completed_tasks()
        
        now = datetime.now(timezone.utc)

        for component in gcal.walk():
            try:
                if component.name == "VEVENT":
                    summary = str(component.get('summary', ''))
                    description = str(component.get('description', ''))
                    dtstart_obj = component.get('dtstart')
                    
                    if not dtstart_obj:
                        continue
                        
                    dtstart = dtstart_obj.dt
                    
                    # Normalize dtstart
                    if isinstance(dtstart, datetime):
                        if dtstart.tzinfo is None:
                            dtstart = dtstart.replace(tzinfo=timezone.utc)
                    else:
                        dtstart = datetime.combine(dtstart, datetime.min.time()).replace(tzinfo=timezone.utc)

                    # 1. Extract Course Name
                    course_name = "כללי"
                    categories = component.get('categories')
                    if categories:
                        cat_string = str(categories.cats[0])
                        parts = cat_string.split(' - ')
                        if len(parts) > 1:
                            course_name = parts[1].strip()

                    # Normalize summary for stable ID
                    norm_summary = self.normalize_summary(summary)
                    task_id = hashlib.md5(f"{course_name}{norm_summary}".encode()).hexdigest()

                    # 2. Extract Assignment Type and Number
                    assignment_type = None
                    assignment_number = None
                    assignment_match = re.search(r'(תרגיל|מטלה|בוחן|מבחן)\s*(\d+)', summary, re.IGNORECASE)
                    if assignment_match:
                        assignment_type = assignment_match.group(1).strip()
                        assignment_number = assignment_match.group(2).strip()

                    # 3. Classify Track (Series)
                    track = "general"
                    track_label = ""
                    lower_summary = summary.lower()
                    lower_description = description.lower()
                    
                    if "zemax" in lower_summary or "zemax" in lower_description:
                        track = "zemax"
                        track_label = "Zemax"
                    elif any(kw in lower_summary or kw in lower_description for kw in ["ידני", "manual", "שיעור"]):
                        track = "manual"
                        track_label = "ידני"
                    elif "מעבדה" in lower_summary or "lab" in lower_summary:
                        track = "lab"
                        track_label = "מעבדה"

                    # 4. Classify and Filter
                    assignment_keywords = [
                        "יש להגיש", "is due", "תיבת הגשה", "מטלה", "תרגיל", "מבחן", 
                        "בוחן", "הגשת", "deadline", "task", "משימה", "עבודה", 
                        "פרויקט", "project", "assignment", "quiz", "exam",
                        "מכין", "מסכם", "תוצאות", "ניסוי"
                    ]
                    is_explicit_task = any(kw in lower_summary or kw in lower_description for kw in assignment_keywords)

                    is_lesson = False
                    lesson_keywords = ["הרצאה", "תרגול", "שיעור", "lecture", "tutorial", "lesson", "zoom", "זום"]
                    
                    # If it's a lesson (but not an explicit task), we mark it to be skipped
                    if any(kw in lower_summary for kw in lesson_keywords) and not is_explicit_task:
                        is_lesson = True

                    # Logic: If it has course info OR is an explicit task, AND it's not a lesson
                    should_display = (is_explicit_task or course_name != "כללי") and not is_lesson

                    if not should_display:
                        continue

                    # 5. Create a clean title
                    if assignment_type and assignment_number:
                        clean_title = f"{assignment_type} {assignment_number}"
                        if track_label and track_label.lower() not in clean_title.lower():
                            clean_title = f"{clean_title} ({track_label})"
                        remaining = norm_summary.replace(assignment_match.group(0), "")
                        if "[" in remaining:
                            remaining = remaining.split("[")[0]
                        extra = remaining.strip(" -:[]'\"")
                        if extra and len(extra) > 2 and extra.lower() not in clean_title.lower():
                            clean_title = f"{clean_title} - {extra}"
                    else:
                        clean_title = norm_summary
                        if "[" in clean_title:
                            clean_title = clean_title.split("[")[0].strip()
                    
                    new_event = {
                        "id": task_id,
                        "title": clean_title,
                        "course": course_name,
                        "track": track,
                        "full_title": summary,
                        "description": description,
                        "due_date": dtstart.isoformat(),
                        "is_past": dtstart < now,
                        "is_completed": task_id in completed_ids,
                        "category": "assignment"
                    }

                    # Deduplication: Keep the one with the latest date
                    if task_id in tasks_map:
                        existing_date = datetime.fromisoformat(tasks_map[task_id]['due_date'])
                        if dtstart > existing_date:
                            tasks_map[task_id] = new_event
                    else:
                        tasks_map[task_id] = new_event

            except Exception as e:
                print(f"Error parsing event: {e}")
                continue

        # Sort and return
        events = list(tasks_map.values())
        events.sort(key=lambda x: x['due_date'])
        return events

if __name__ == "__main__":
    try:
        client = MoodleCalendarClient()
        events = client.fetch_events()
        print(f"Found {len(events)} upcoming events.")
        for event in events[:5]:
            print(f"- {event['title']} ({event['due_date']})")
    except Exception as e:
        print(f"Error: {e}")
