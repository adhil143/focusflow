import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const pad = (n) => String(n).padStart(2, "0");

// local time string like 2026-11-12T14:30:00 (the backend reads the hour from it)
function localIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export default function Timer({ refresh, onSessionSaved }) {
  const [mode, setMode] = useState("focus"); // focus | break
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [logging, setLogging] = useState(null); // { completed, minutes } when the log form is open
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(3);

  const endAt = useRef(null);
  const startedAt = useRef(null);

  const totalSeconds = (mode === "focus" ? focusMin : breakMin) * 60;

  useEffect(() => {
    api.getTasks({}).then((all) => setTasks(all.filter((t) => t.status !== "done")));
    api.getSessions().then(setSessions);
    api.getPomodoroSuggestion().then(setSuggestion);
  }, [refresh]);

  // countdown: compare with the end time so the clock stays accurate
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.round((endAt.current - Date.now()) / 1000);
      if (left <= 0) {
        setSecondsLeft(0);
        setRunning(false);
        if (mode === "focus") {
          setLogging({ completed: true, minutes: focusMin });
        }
      } else {
        setSecondsLeft(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, mode, focusMin]);

  function resetTimer(newMode = mode, focus = focusMin, brk = breakMin) {
    setRunning(false);
    setMode(newMode);
    setSecondsLeft((newMode === "focus" ? focus : brk) * 60);
    startedAt.current = null;
    setLogging(null);
  }

  function start() {
    const left = secondsLeft === 0 ? totalSeconds : secondsLeft;
    setSecondsLeft(left);
    endAt.current = Date.now() + left * 1000;
    if (!startedAt.current) startedAt.current = new Date();
    setRunning(true);
  }

  function pause() {
    setSecondsLeft(Math.max(0, Math.round((endAt.current - Date.now()) / 1000)));
    setRunning(false);
  }

  function finishEarly() {
    pause();
    const elapsed = (totalSeconds - Math.round((endAt.current - Date.now()) / 1000)) / 60;
    setLogging({ completed: false, minutes: Math.max(elapsed, 0.1) });
  }

  async function saveSession(e) {
    e.preventDefault();
    await api.createSession({
      task_id: taskId ? Number(taskId) : null,
      planned_minutes: focusMin,
      duration_minutes: logging.minutes,
      completed: logging.completed,
      distraction_notes: notes,
      productivity_rating: Number(rating),
      started_at: localIso(startedAt.current),
    });
    const wasCompleted = logging.completed;
    setNotes("");
    setRating(3);
    onSessionSaved();
    // after a finished pomodoro, move on to the break
    resetTimer(wasCompleted ? "break" : "focus");
  }

  function applySuggestion() {
    setFocusMin(suggestion.focus_minutes);
    setBreakMin(suggestion.break_minutes);
    resetTimer("focus", suggestion.focus_minutes, suggestion.break_minutes);
  }

  const started = secondsLeft !== totalSeconds;

  return (
    <div>
      <div className="panel timer">
        <div className="mode">
          <button className={mode === "focus" ? "active" : ""} disabled={running} onClick={() => resetTimer("focus")}>
            Focus
          </button>
          <button className={mode === "break" ? "active" : ""} disabled={running} onClick={() => resetTimer("break")}>
            Break
          </button>
        </div>

        <div className="clock">
          {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
        </div>

        <div className="actions">
          {!running && <button onClick={start}>{started ? "Resume" : "Start"}</button>}
          {running && <button onClick={pause}>Pause</button>}
          <button onClick={() => resetTimer()}>Reset</button>
          {mode === "focus" && started && !logging && <button onClick={finishEarly}>Finish early</button>}
        </div>

        <div className="settings">
          <label>
            Focus (min)
            <input
              type="number" min="1" value={focusMin} disabled={running || started}
              onChange={(e) => { setFocusMin(Number(e.target.value)); resetTimer("focus", Number(e.target.value), breakMin); }}
            />
          </label>
          <label>
            Break (min)
            <input
              type="number" min="1" value={breakMin} disabled={running || started}
              onChange={(e) => { setBreakMin(Number(e.target.value)); resetTimer(mode, focusMin, Number(e.target.value)); }}
            />
          </label>
          <label>
            Task
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </label>
        </div>

        {suggestion && (
          <p className="hint">
            Suggested: {suggestion.focus_minutes} min focus / {suggestion.break_minutes} min break.{" "}
            <button onClick={applySuggestion} disabled={running}>Use this</button>
          </p>
        )}
      </div>

      {logging && (
        <form className="panel form" onSubmit={saveSession}>
          <h2>{logging.completed ? "Pomodoro finished" : "Log this session"}</h2>
          <label>
            Distractions (what pulled your attention?)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" />
          </label>
          <label>
            Productivity (1 low – 5 high)
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <button type="submit">Save session</button>
        </form>
      )}

      <div className="panel">
        <h2>Session history</h2>
        {sessions.length === 0 && <p>No sessions yet. Start the timer to log your first one.</p>}
        <ul className="history">
          {sessions.map((s) => (
            <li key={s.id}>
              <strong>{s.started_at.replace("T", " ").slice(0, 16)}</strong>{" "}
              {s.task_title || "No task"} – {s.duration_minutes} min
              {s.completed ? "" : " (stopped early)"}
              {s.productivity_rating && `, rating ${s.productivity_rating}/5`}
              {s.distraction_notes && <div className="meta">Distraction: {s.distraction_notes}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
