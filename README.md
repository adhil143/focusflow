# FocusFlow

A focused-work manager that combines a Pomodoro timer, a task board and distraction logging.

## Features
- Tasks with title, estimated pomodoros, priority, category (work / study / personal), start date, due date and tags
- Task board (todo / doing / done) or list view, filter by category, priority and tag
- Pomodoro timer with start, pause, reset, finish early and a break mode
- Session logging: distraction notes and a 1-5 productivity rating, plus session history
- Analytics: completed pomodoros, average session length, total focus time, best focus hours, charts
- AI features (rule based, no API key needed):
  - Suggested focus/break length from your session history
  - Distraction note analysis with recommended remedies
  - Auto-prioritised task order based on priority, deadline and remaining effort

## Tech
- Frontend: React (Vite) + Recharts
- Backend: Python, FastAPI
- Database: SQLite (created automatically)

## Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac / Linux
pip install -r requirements.txt
uvicorn main:app --reload
```
API runs on http://localhost:8000 (docs at http://localhost:8000/docs).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App runs on http://localhost:5173.

## Environment variables
Both are optional; the defaults work locally.

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `DATABASE_PATH` | backend | `focusflow.db` | SQLite file location |
| `FRONTEND_URL` | backend | `http://localhost:5173` | Origin allowed by CORS |
| `VITE_API_URL` | frontend | `http://localhost:8000` | Backend URL |

See `backend/.env.example` and `frontend/.env.example`.
