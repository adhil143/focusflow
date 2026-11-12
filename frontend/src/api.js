const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getTasks: (filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    return request("/tasks?" + new URLSearchParams(clean));
  },
  createTask: (task) => request("/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id, task) => request(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(task) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),

  getSessions: () => request("/sessions?limit=20"),
  createSession: (s) => request("/sessions", { method: "POST", body: JSON.stringify(s) }),

  getAnalytics: () => request("/analytics"),
  getPomodoroSuggestion: () => request("/ai/pomodoro-suggestion"),
  getDistractions: () => request("/ai/distractions"),
  getPriorities: () => request("/ai/prioritize"),
};
