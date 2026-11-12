import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AIInsights({ refresh }) {
  const [suggestion, setSuggestion] = useState(null);
  const [distractions, setDistractions] = useState(null);
  const [priorities, setPriorities] = useState([]);

  useEffect(() => {
    api.getPomodoroSuggestion().then(setSuggestion);
    api.getDistractions().then(setDistractions);
    api.getPriorities().then(setPriorities);
  }, [refresh]);

  return (
    <div>
      <div className="panel">
        <h2>Suggested Pomodoro pattern</h2>
        {suggestion && (
          <>
            <p><strong>{suggestion.focus_minutes} min focus / {suggestion.break_minutes} min break</strong></p>
            <p>{suggestion.reason}</p>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Recurring distractions</h2>
        {distractions && distractions.distractors.length === 0 && (
          <p>No patterns yet. Add distraction notes when you log sessions.</p>
        )}
        {distractions && distractions.distractors.length > 0 && (
          <>
            <p className="meta">Based on {distractions.notes_analysed} session notes</p>
            <ul>
              {distractions.distractors.map((d) => (
                <li key={d.distractor}>
                  <strong>{d.distractor}</strong> ({d.count}×) – {d.remedy}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Suggested task order</h2>
        {priorities.length === 0 && <p>No open tasks.</p>}
        <ol>
          {priorities.map((t) => (
            <li key={t.id}>
              <strong>{t.title}</strong> (score {t.score})
              <div className="meta">{t.reason}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
