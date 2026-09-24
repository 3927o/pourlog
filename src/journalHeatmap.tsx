import { useEffect, useRef, useState } from "react";
import type { Journal } from "./models";

const HEATMAP_DAY_COUNT = 30;

export interface HeatmapDay {
  date: Date;
  key: string;
  count: number;
  level: number;
}

export interface HeatmapData {
  days: HeatmapDay[];
  total: number;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function localDayKey(date: Date) {
  return [
    date.getFullYear(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate()),
  ].join("-");
}

function startOfLocalDay(value: number | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function levelForCount(count: number) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

export function buildHeatmapData(
  journals: Journal[],
  now: number | Date = Date.now(),
): HeatmapData {
  const countsByDay = new Map<string, number>();
  for (const journal of journals) {
    const key = localDayKey(new Date(journal.createdAt));
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const today = startOfLocalDay(now);
  const days: HeatmapDay[] = [];
  let total = 0;
  for (let index = 0; index < HEATMAP_DAY_COUNT; index += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - (HEATMAP_DAY_COUNT - 1 - index));
    const key = localDayKey(date);
    const count = countsByDay.get(key) ?? 0;
    total += count;
    days.push({ date, key, count, level: levelForCount(count) });
  }

  return { days, total };
}

function fullDateLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", ".");
}

function dayDetailLabel(day: HeatmapDay) {
  return `${fullDateLabel(day.date)} · ${day.count} 条记录`;
}

export function JournalHeatmap({ journals }: { journals: Journal[] }) {
  const [data, setData] = useState(() => buildHeatmapData(journals));
  const [selectedDay, setSelectedDay] = useState<HeatmapDay>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setData(buildHeatmapData(journals));
  }, [journals]);

  useEffect(() => {
    if (!selectedDay) return;

    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedDay(undefined);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      returnFocusRef.current?.focus();
    };
  }, [selectedDay]);

  const firstDay = data.days[0];
  const lastDay = data.days[data.days.length - 1];
  const leadingEmptyCells = (firstDay.date.getDay() + 6) % 7;

  return (
    <>
      <section
        aria-label="最近 30 天冲煮记录热力图"
        className="journal-heatmap"
      >
        <header>
          <div>
            <h2>ACTIVITY · 最近 30 天</h2>
            <strong>
              {fullDateLabel(firstDay.date)} — {fullDateLabel(lastDay.date)}
            </strong>
          </div>
          <span>{data.total} LOGS</span>
        </header>
        <div className="heatmap-layout">
          <div className="heatmap-weekdays" aria-hidden="true">
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
            <span>日</span>
          </div>
          <div className="heatmap-grid">
            {Array.from({ length: leadingEmptyCells }, (_, index) => (
              <span
                aria-hidden="true"
                className="heatmap-cell empty"
                key={`empty-${index}`}
              />
            ))}
            {data.days.map((day) => {
              const label = dayDetailLabel(day);
              return (
                <button
                  aria-label={label}
                  className="heatmap-cell"
                  data-level={day.level}
                  key={day.key}
                  onClick={(event) => {
                    returnFocusRef.current = event.currentTarget;
                    setSelectedDay(day);
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="heatmap-tooltip">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <footer>
          <span>少</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i className="heatmap-cell" data-level={level} key={level} />
          ))}
          <span>多</span>
        </footer>
      </section>
      {selectedDay && (
        <div
          className="dialog-backdrop heatmap-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDay(undefined);
            }
          }}
          ref={dialogRef}
          role="presentation"
        >
          <section
            aria-labelledby="journal-heatmap-dialog-title"
            aria-modal="true"
            className="app-dialog heatmap-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <p>HEATMAP · 记录详情</p>
              <h2 id="journal-heatmap-dialog-title">
                {fullDateLabel(selectedDay.date)}
              </h2>
              <button
                aria-label="关闭记录详情"
                onClick={() => setSelectedDay(undefined)}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="dialog-body heatmap-dialog-body">
              <p>
                当天共有 <strong>{selectedDay.count}</strong> 条冲煮记录。
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
