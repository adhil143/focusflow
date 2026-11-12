import { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY_FORM = {
  title: "",
  estimated_pomodoros: 1,
  priority: "medium",
  category: "work",
  start_date: "",
  due_date: "",
  tags: "",
};

const STATUSES = ["todo", "doing", "done"];

export default function Tasks({ refresh, onChange }) {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filters, setFilters] = useState({ category: "", priority: "", tag: "" });
  const [view, setView] = useState("board");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTasks(filters).then(setTasks).catch((e) => setError(e.message));
  }, [filters, refresh]);

  const setField = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  async function addTask(e) {
    e.preventDefault();
    try {
      await api.createTask({ ...form, estimated_pomodoros: Number(form.estimated_pomodoros) });
      setForm(EMPTY_FORM);
      setError("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function moveTask(task, status) {
    await api.updateTask(task.id, { ...task, status });
    onChange();
  }

  async function removeTask(id) {
    if (!window.confirm("Delete this task and its sessions?")) return;
    await api.deleteTask(id);
    onChange();
  }

  function Card({ task }) {
    return (
      <div className={`card ${task.priority}`}>
        <strong>{task.title}</strong>
        <div className="meta">
          {task.category} · {task.priority} · {task.completed_pomodoros}/{task.estimated_pomodoros} pomodoros
        </div>
        {(task.start_date || task.due_date) && (
          <div className="meta">
            {task.start_date && `starts ${task.start_date}`} {task.due_date && `due ${task.due_date}`}
          </div>
        )}
        {task.tags && (
          <div className="tags">
            {task.tags.split(",").map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        )}
        <div className="actions">
          {STATUSES.filter((s) => s !== task.status).map((s) => (
            <button key={s} onClick={() => moveTask(task, s)}>
              Move to {s}
            </button>
          ))}
          <button className="danger" onClick={() => removeTask(task.id)}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form className="panel form" onSubmit={addTask}>
        <h2>New task</h2>
        <input name="title" placeholder="Task title" value={form.title} onChange={setField} required />
        <label>
          Estimated pomodoros
          <input type="number" min="1" name="estimated_pomodoros" value={form.estimated_pomodoros} onChange={setField} />
        </label>
        <label>
          Priority
          <select name="priority" value={form.priority} onChange={setField}>
            <option>low</option>
            <option>medium</option>
            <option>high</option>
          </select>
        </label>
        <label>
          Category
          <select name="category" value={form.category} onChange={setField}>
            <option>work</option>
            <option>study</option>
            <option>personal</option>
          </select>
        </label>
        <label>
          Start date
          <input type="date" name="start_date" value={form.start_date} onChange={setField} />
        </label>
        <label>
          Due date
          <input type="date" name="due_date" value={form.due_date} onChange={setField} />
        </label>
        <input name="tags" placeholder="Tags (comma separated)" value={form.tags} onChange={setField} />
        <button type="submit">Add task</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="filters">
        <select name="category" value={filters.category} onChange={setFilter}>
          <option value="">All categories</option>
          <option>work</option>
          <option>study</option>
          <option>personal</option>
        </select>
        <select name="priority" value={filters.priority} onChange={setFilter}>
          <option value="">All priorities</option>
          <option>low</option>
          <option>medium</option>
          <option>high</option>
        </select>
        <input name="tag" placeholder="Filter by tag" value={filters.tag} onChange={setFilter} />
        <button onClick={() => setView(view === "board" ? "list" : "board")}>
          Show {view === "board" ? "list" : "board"}
        </button>
      </div>

      {tasks.length === 0 && <p>No tasks yet. Add your first task above.</p>}

      {view === "board" ? (
        <div className="board">
          {STATUSES.map((s) => (
            <div className="column" key={s}>
              <h3>{s}</h3>
              {tasks.filter((t) => t.status === s).map((t) => (
                <Card key={t.id} task={t} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="list">
          {tasks.map((t) => (
            <Card key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
