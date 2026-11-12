import { useState } from "react";
import Tasks from "./components/Tasks.jsx";
import Timer from "./components/Timer.jsx";
import Analytics from "./components/Analytics.jsx";
import AIInsights from "./components/AIInsights.jsx";

const TABS = ["Tasks", "Timer", "Analytics", "AI Insights"];

export default function App() {
  const [tab, setTab] = useState("Tasks");
  // bump this number to make child components reload their data
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((n) => n + 1);

  return (
    <div className="app">
      <header>
        <h1>FocusFlow</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "Tasks" && <Tasks refresh={refresh} onChange={reload} />}
        {tab === "Timer" && <Timer refresh={refresh} onSessionSaved={reload} />}
        {tab === "Analytics" && <Analytics refresh={refresh} />}
        {tab === "AI Insights" && <AIInsights refresh={refresh} />}
      </main>
    </div>
  );
}
