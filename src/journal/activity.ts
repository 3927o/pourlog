function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildJournalActivity(timestamps: number[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const lastDayOfStartMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 2,
    0,
  ).getDate();
  rangeStart.setDate(Math.min(today.getDate(), lastDayOfStartMonth));
  const gridStart = new Date(rangeStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + 6 - today.getDay());

  const counts = new Map<string, number>();
  for (const timestamp of timestamps) {
    const key = localDateKey(new Date(timestamp));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: Array<{ key: string; count: number; outside: boolean }> = [];
  const months: Array<{ column: number; label: string }> = [];
  for (
    const date = new Date(gridStart);
    date <= gridEnd;
    date.setDate(date.getDate() + 1)
  ) {
    const outside = date < rangeStart || date > today;
    if (
      !outside &&
      (date.getTime() === rangeStart.getTime() || date.getDate() === 1)
    ) {
      const month = {
        column: Math.floor(days.length / 7) + 1,
        label: `${date.getMonth() + 1}月`,
      };
      if (months.at(-1)?.column === month.column) months.pop();
      months.push(month);
    }
    const key = localDateKey(date);
    days.push({ key, count: outside ? 0 : (counts.get(key) ?? 0), outside });
  }

  return {
    days,
    months,
    weeks: days.length / 7,
    activeDays: days.filter((day) => day.count > 0).length,
    totalBrews: days.reduce((total, day) => total + day.count, 0),
  };
}
