import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api.js";

export default function Analytics({ refresh }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getAnalytics().then(setData);
  }, [refresh]);

  if (!data) return <p>Loading...</p>;

  const best = data.best_hours.length
    ? data.best_hours.map((h) => `${pad(h.hour)}:00`).join(", ")
    : "Not enough data yet";

  return (
    <div>
      <div className="stats">
        <div className="panel">
          <div className="big">{data.completed_pomodoros}</div>
          Completed pomodoros
        </div>
        <div className="panel">
          <div className="big">{data.average_session_minutes} min</div>
          Average session length
        </div>
        <div className="panel">
          <div className="big">{data.total_focus_minutes} min</div>
          Total focus time
        </div>
        <div className="panel">
          <div className="big small">{best}</div>
          Best focus hours
        </div>
      </div>

      <div className="panel">
        <h2>Pomodoros in the last 7 days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="pomodoros" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2>Completed pomodoros by hour of day</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.hours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="sessions" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}
