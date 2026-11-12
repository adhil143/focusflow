# FocusFlow - Project Documentation

## 1. Overview
FocusFlow helps a user plan tasks, work in Pomodoro sessions and learn from their own focus data.

## 2. Architecture
React single-page app -> REST (JSON) -> FastAPI -> SQLite.

- `backend/main.py` - all API routes, database setup and AI logic
- `frontend/src/api.js` - one place for all API calls
- `frontend/src/components/` - Tasks, Timer, Analytics, AIInsights

## 3. Database
**tasks**: id, title, estimated_pomodoros, priority (low/medium/high), category (work/study/personal), start_date, due_date, tags (comma separated, lowercase), status (todo/doing/done)

**sessions**: id, task_id, planned_minutes, duration_minutes (actual), completed, distraction_notes, productivity_rating (1-5), started_at, day, hour

A task's completed pomodoros are counted from its completed sessions. Deleting a task deletes its sessions.

## 4. API
| Method | Path | Description |
|---|---|---|
| GET | `/tasks?category=&priority=&status=&tag=` | List / filter tasks |
| POST | `/tasks` | Create task |
| PUT | `/tasks/{id}` | Update task (also used to move between columns) |
| DELETE | `/tasks/{id}` | Delete task |
| GET | `/sessions?limit=` | Recent sessions |
| POST | `/sessions` | Save a session |
| GET | `/analytics` | Totals, average length, best hours, chart data |
| GET | `/ai/pomodoro-suggestion` | Suggested focus/break length |
| GET | `/ai/distractions` | Recurring distractors and remedies |
| GET | `/ai/prioritize` | Open tasks ranked by score |

## 5. Timer
The timer stores an end timestamp and compares it with the current time on every tick, so it stays accurate even if the browser throttles the tab. When a focus period ends, a form asks for distraction notes and a rating, then saves the session and switches to break mode. "Finish early" saves the session as not completed (it does not count as a completed pomodoro).

## 6. AI features
No external AI API is used, so there is no key to configure.

**Pomodoro suggestion** - needs at least 5 rated sessions. Sessions are grouped by planned length; each group (with 2+ sessions) is scored as average rating x completion rate. The best length is suggested, with a 5, 10 or 15 minute break depending on length.

**Distraction analysis** - each note is matched against keyword groups (phone, social media, notifications/email, noise/people, tiredness/hunger, wandering mind). Groups are ranked by how many notes mention them, each with a remedy.

**Auto-prioritise** - score = priority (30/20/10) + deadline urgency (up to 30, +40 if overdue) + a small quick-win bonus for tasks with few pomodoros left, minus 15 if the start date is in the future. Open tasks are sorted by score.

## 7. Analytics
- Completed pomodoros = sessions that ran to the end
- Average session length = mean actual minutes of all sessions
- Best focus hours = top 3 hours of the day by completed pomodoros (rating breaks ties)

## 8. Possible improvements
WebSocket timer sync across tabs, Google Calendar sync, XP and streak badges, PDF export, deployment (Vercel + Railway).
