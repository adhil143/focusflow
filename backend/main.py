import os
import re
import sqlite3
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = os.getenv("DATABASE_PATH", "focusflow.db")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app = FastAPI(title="FocusFlow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- database helpers ----------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_all(sql, params=()):
    conn = get_conn()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def fetch_one(sql, params=()):
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def run(sql, params=()):
    conn = get_conn()
    cur = conn.execute(sql, params)
    conn.commit()
    last_id = cur.lastrowid
    conn.close()
    return last_id


@app.on_event("startup")
def create_tables():
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            estimated_pomodoros INTEGER NOT NULL DEFAULT 1,
            priority TEXT NOT NULL DEFAULT 'medium',
            category TEXT NOT NULL DEFAULT 'work',
            start_date TEXT,
            due_date TEXT,
            tags TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'todo'
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            planned_minutes INTEGER NOT NULL,
            duration_minutes REAL NOT NULL,
            completed INTEGER NOT NULL,
            distraction_notes TEXT NOT NULL DEFAULT '',
            productivity_rating INTEGER,
            started_at TEXT NOT NULL,
            day TEXT NOT NULL,
            hour INTEGER NOT NULL
        )"""
    )
    conn.commit()
    conn.close()


# ---------- schemas ----------

class TaskIn(BaseModel):
    title: str = Field(min_length=1)
    estimated_pomodoros: int = Field(1, ge=1)
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    category: str = Field("work", pattern="^(work|study|personal)$")
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    tags: str = ""
    status: str = Field("todo", pattern="^(todo|doing|done)$")


class SessionIn(BaseModel):
    task_id: Optional[int] = None
    planned_minutes: int = Field(gt=0)
    duration_minutes: float = Field(gt=0)
    completed: bool = True
    distraction_notes: str = ""
    productivity_rating: Optional[int] = Field(None, ge=1, le=5)
    started_at: str  # local time, e.g. 2026-11-12T14:30:00


def clean_tags(tags: str) -> str:
    parts = [t.strip().lower() for t in tags.split(",")]
    return ",".join(t for t in parts if t)


# ---------- tasks ----------

TASK_SELECT = """SELECT t.*,
    (SELECT COUNT(*) FROM sessions s
     WHERE s.task_id = t.id AND s.completed = 1) AS completed_pomodoros
    FROM tasks t"""


@app.get("/tasks")
def list_tasks(
    category: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
):
    sql = TASK_SELECT + " WHERE 1=1"
    params = []
    if category:
        sql += " AND t.category = ?"
        params.append(category)
    if priority:
        sql += " AND t.priority = ?"
        params.append(priority)
    if status:
        sql += " AND t.status = ?"
        params.append(status)
    if tag:
        sql += " AND (',' || t.tags || ',') LIKE ?"
        params.append(f"%,{tag.strip().lower()},%")
    sql += " ORDER BY t.id DESC"
    return fetch_all(sql, params)


@app.post("/tasks", status_code=201)
def create_task(task: TaskIn):
    task_id = run(
        """INSERT INTO tasks (title, estimated_pomodoros, priority, category,
           start_date, due_date, tags, status) VALUES (?,?,?,?,?,?,?,?)""",
        (task.title, task.estimated_pomodoros, task.priority, task.category,
         task.start_date or None, task.due_date or None,
         clean_tags(task.tags), task.status),
    )
    return fetch_one(TASK_SELECT + " WHERE t.id = ?", (task_id,))


@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskIn):
    if not fetch_one("SELECT id FROM tasks WHERE id = ?", (task_id,)):
        raise HTTPException(404, "Task not found")
    run(
        """UPDATE tasks SET title=?, estimated_pomodoros=?, priority=?, category=?,
           start_date=?, due_date=?, tags=?, status=? WHERE id=?""",
        (task.title, task.estimated_pomodoros, task.priority, task.category,
         task.start_date or None, task.due_date or None,
         clean_tags(task.tags), task.status, task_id),
    )
    return fetch_one(TASK_SELECT + " WHERE t.id = ?", (task_id,))


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int):
    run("DELETE FROM sessions WHERE task_id = ?", (task_id,))
    run("DELETE FROM tasks WHERE id = ?", (task_id,))


# ---------- sessions ----------

@app.post("/sessions", status_code=201)
def create_session(s: SessionIn):
    try:
        started = datetime.fromisoformat(s.started_at)
    except ValueError:
        raise HTTPException(422, "started_at must be an ISO date-time")
    session_id = run(
        """INSERT INTO sessions (task_id, planned_minutes, duration_minutes, completed,
           distraction_notes, productivity_rating, started_at, day, hour)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (s.task_id, s.planned_minutes, round(s.duration_minutes, 1),
         int(s.completed), s.distraction_notes.strip(), s.productivity_rating,
         s.started_at, started.date().isoformat(), started.hour),
    )
    return fetch_one("SELECT * FROM sessions WHERE id = ?", (session_id,))


@app.get("/sessions")
def list_sessions(limit: int = 20):
    return fetch_all(
        """SELECT s.*, t.title AS task_title FROM sessions s
           LEFT JOIN tasks t ON t.id = s.task_id
           ORDER BY s.started_at DESC LIMIT ?""",
        (limit,),
    )


# ---------- analytics ----------

@app.get("/analytics")
def analytics():
    sessions = fetch_all("SELECT * FROM sessions")
    completed = [s for s in sessions if s["completed"]]

    total_minutes = sum(s["duration_minutes"] for s in sessions)
    avg_length = round(total_minutes / len(sessions), 1) if sessions else 0

    by_hour = [{"hour": h, "sessions": 0, "ratings": []} for h in range(24)]
    for s in completed:
        by_hour[s["hour"]]["sessions"] += 1
        if s["productivity_rating"]:
            by_hour[s["hour"]]["ratings"].append(s["productivity_rating"])

    hours = []
    for h in by_hour:
        avg = round(sum(h["ratings"]) / len(h["ratings"]), 1) if h["ratings"] else 0
        hours.append({"hour": h["hour"], "sessions": h["sessions"], "avg_rating": avg})

    # best hours = most completed pomodoros, higher rating breaks ties
    ranked = sorted(
        [h for h in hours if h["sessions"] > 0],
        key=lambda h: (h["sessions"], h["avg_rating"]),
        reverse=True,
    )

    today = date.today()
    daily = []
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        count = sum(1 for s in completed if s["day"] == d)
        daily.append({"day": d[5:], "pomodoros": count})

    return {
        "completed_pomodoros": len(completed),
        "total_sessions": len(sessions),
        "total_focus_minutes": round(total_minutes, 1),
        "average_session_minutes": avg_length,
        "best_hours": ranked[:3],
        "hours": hours,
        "daily": daily,
    }


# ---------- AI features (rule based, no external API needed) ----------

@app.get("/ai/pomodoro-suggestion")
def pomodoro_suggestion():
    """Pick the planned length that gave the best rating * completion rate."""
    rows = fetch_all("SELECT * FROM sessions WHERE productivity_rating IS NOT NULL")
    if len(rows) < 5:
        return {
            "focus_minutes": 25,
            "break_minutes": 5,
            "reason": "Not enough history yet (need 5 rated sessions). "
                      "Starting with the classic 25/5 pattern.",
        }

    groups = {}
    for r in rows:
        groups.setdefault(r["planned_minutes"], []).append(r)

    best_len, best_score = None, -1
    for length, items in groups.items():
        if len(items) < 2:
            continue
        avg_rating = sum(i["productivity_rating"] for i in items) / len(items)
        completion = sum(i["completed"] for i in items) / len(items)
        score = avg_rating * completion
        if score > best_score:
            best_len, best_score = length, score

    if best_len is None:
        return {
            "focus_minutes": 25,
            "break_minutes": 5,
            "reason": "Try a few more sessions at the same length so a pattern can show up.",
        }

    brk = 5 if best_len <= 30 else 10 if best_len < 50 else 15
    return {
        "focus_minutes": best_len,
        "break_minutes": brk,
        "reason": f"Your {best_len}-minute sessions have the best mix of focus rating "
                  f"and completion. Take a longer 15-20 minute break after every 4 sessions.",
    }


DISTRACTORS = {
    "Phone and messages": (
        ["phone", "mobile", "whatsapp", "text", "call", "dm"],
        "Put the phone in another room or on Do Not Disturb during a pomodoro.",
    ),
    "Social media": (
        ["instagram", "youtube", "twitter", "reddit", "facebook", "tiktok", "linkedin", "social"],
        "Use a site blocker during focus time and check feeds only on breaks.",
    ),
    "Notifications and email": (
        ["notification", "email", "mail", "slack", "teams", "ping"],
        "Turn off desktop alerts and check email at fixed times only.",
    ),
    "Noise and people": (
        ["noise", "noisy", "loud", "family", "roommate", "colleague", "people", "talking", "interrupt"],
        "Use headphones, or tell people your focus hours so they can wait.",
    ),
    "Tiredness and hunger": (
        ["tired", "sleepy", "hungry", "snack", "coffee", "thirsty"],
        "Eat and drink water before starting, and schedule hard tasks for your best hours.",
    ),
    "Wandering mind": (
        ["mind", "wander", "daydream", "thinking", "worry", "stress", "anxious", "bored", "procrastinat"],
        "Keep a scratch list: write the stray thought down and go back to the task.",
    ),
}


@app.get("/ai/distractions")
def distraction_analysis():
    rows = fetch_all("SELECT distraction_notes FROM sessions WHERE distraction_notes != ''")
    notes = [r["distraction_notes"].lower() for r in rows]
    results = []
    for name, (keywords, remedy) in DISTRACTORS.items():
        count = sum(
            1 for n in notes if any(re.search(r"\b" + k, n) for k in keywords)
        )
        if count:
            results.append({"distractor": name, "count": count, "remedy": remedy})
    results.sort(key=lambda r: r["count"], reverse=True)
    return {"notes_analysed": len(notes), "distractors": results}


@app.get("/ai/prioritize")
def prioritize_tasks():
    """Score open tasks from priority, deadline and remaining effort."""
    tasks = fetch_all(TASK_SELECT + " WHERE t.status != 'done'")
    today = date.today()
    weights = {"high": 30, "medium": 20, "low": 10}
    ranked = []
    for t in tasks:
        score = weights[t["priority"]]
        reasons = [f"{t['priority']} priority"]

        if t["due_date"]:
            days_left = (date.fromisoformat(t["due_date"]) - today).days
            if days_left < 0:
                score += 40
                reasons.append("overdue")
            else:
                score += max(0, 30 - days_left * 3)
                reasons.append(f"due in {days_left} day(s)")

        remaining = max(t["estimated_pomodoros"] - t["completed_pomodoros"], 1)
        score += max(0, 10 - remaining * 2)  # small bonus for quick wins
        reasons.append(f"{remaining} pomodoro(s) left")

        if t["start_date"] and date.fromisoformat(t["start_date"]) > today:
            score -= 15
            reasons.append("starts later")

        ranked.append({"id": t["id"], "title": t["title"], "score": score,
                       "reason": ", ".join(reasons)})
    ranked.sort(key=lambda r: r["score"], reverse=True)
    return ranked
