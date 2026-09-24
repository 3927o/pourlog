import type { CSSProperties } from "react";
import { buildJournalActivity } from "./activity";
import "./journalActivity.css";

export function JournalActivity({ timestamps }: { timestamps: number[] }) {
  const activity = buildJournalActivity(timestamps);

  return (
    <section
      className="content journal-activity"
      aria-label="近三个月冲煮活跃度"
    >
      <div className="activity-card">
        <header className="activity-heading">
          <div>
            <small>BREW ACTIVITY / 近三个月</small>
            <h2>冲煮足迹</h2>
          </div>
          <p>
            <strong>{activity.totalBrews}</strong> 杯冲煮
          </p>
        </header>
        <div
          className="activity-calendar"
          style={{ "--activity-weeks": activity.weeks } as CSSProperties}
        >
          <div className="activity-months" aria-hidden="true">
            {activity.months.map((month) => (
              <span key={month.label} style={{ gridColumn: month.column }}>
                {month.label}
              </span>
            ))}
          </div>
          <div className="activity-weekdays" aria-hidden="true">
            <span style={{ gridRow: 2 }}>一</span>
            <span style={{ gridRow: 4 }}>三</span>
            <span style={{ gridRow: 6 }}>五</span>
          </div>
          <div
            className="activity-days"
            role="img"
            aria-label={`${activity.activeDays} 天有记录，共 ${activity.totalBrews} 杯`}
          >
            {activity.days.map((day) => (
              <span
                key={day.key}
                className={`activity-cell ${day.outside ? "outside" : `level-${Math.min(day.count, 4)}`}`}
                title={day.outside ? undefined : `${day.key} · ${day.count} 杯`}
              />
            ))}
          </div>
        </div>
        <footer className="activity-footer">
          <span>
            <b>{activity.activeDays}</b> 天有记录
          </span>
          <div className="activity-legend" aria-label="颜色越深，冲煮杯数越多">
            <span>少</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i
                className={`activity-cell level-${level}`}
                key={level}
                aria-hidden="true"
              />
            ))}
            <span>多</span>
          </div>
        </footer>
      </div>
    </section>
  );
}
