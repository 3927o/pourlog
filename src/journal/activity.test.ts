import { describe, expect, it } from "vitest";
import { buildJournalActivity } from "./activity";

describe("journal activity", () => {
  it("counts local days in a rolling three-month window", () => {
    const activity = buildJournalActivity(
      [
        new Date(2026, 5, 24, 23, 59).getTime(),
        new Date(2026, 5, 25, 0, 1).getTime(),
        new Date(2026, 5, 30, 23, 59).getTime(),
        new Date(2026, 6, 1, 0, 1).getTime(),
        new Date(2026, 8, 25, 9).getTime(),
        new Date(2026, 8, 25, 20).getTime(),
        new Date(2026, 8, 26).getTime(),
      ],
      new Date(2026, 8, 25, 12),
    );

    expect(activity.months.map((month) => month.label)).toEqual([
      "6月",
      "7月",
      "8月",
      "9月",
    ]);
    expect(activity.days.find((day) => day.key === "2026-06-24")?.outside).toBe(
      true,
    );
    expect(activity.days.find((day) => day.key === "2026-06-25")?.count).toBe(
      1,
    );
    expect(activity.days.find((day) => day.key === "2026-06-30")?.count).toBe(
      1,
    );
    expect(activity.days.find((day) => day.key === "2026-07-01")?.count).toBe(
      1,
    );
    expect(activity.days.find((day) => day.key === "2026-09-25")?.count).toBe(
      2,
    );
    expect(activity.days.find((day) => day.key === "2026-09-26")?.outside).toBe(
      true,
    );
    expect(activity.activeDays).toBe(4);
    expect(activity.totalBrews).toBe(5);
    expect(activity.days).toHaveLength(activity.weeks * 7);
  });

  it("clamps the start date when the earlier month is shorter", () => {
    const activity = buildJournalActivity(
      [new Date(2026, 1, 27).getTime(), new Date(2026, 1, 28).getTime()],
      new Date(2026, 4, 31),
    );

    expect(activity.days.find((day) => day.key === "2026-02-27")?.outside).toBe(
      true,
    );
    expect(activity.days.find((day) => day.key === "2026-02-28")?.count).toBe(
      1,
    );
  });
});
