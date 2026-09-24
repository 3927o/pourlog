import { describe, expect, it } from "vitest";
import type { Journal } from "./models";
import { buildHeatmapData } from "./journalHeatmap";

function journalAt(createdAt: Date, beanId = "deleted-bean"): Journal {
  return {
    id: `journal-${createdAt.getTime()}`,
    beanId,
    createdAt: createdAt.getTime(),
    recipeSnapshot: {
      method: "热冲",
      coffeeGrams: 15,
      brewWaterGrams: 240,
      iceGrams: 0,
      grind: "中细",
      temperatureC: 90,
      durationSeconds: 150,
      pour: "三段注水",
      steps: [],
      name: "测试配方",
      source: { type: "manual" },
    },
    dims: {
      acid: 3,
      sweet: 3,
      bitter: 3,
      clean: 3,
      finish: 3,
      body: 3,
    },
    notes: "",
  };
}

describe("journal heatmap data", () => {
  it("builds exactly the trailing 30 local calendar days", () => {
    const now = new Date(2026, 8, 24, 18, 30);
    const data = buildHeatmapData([], now);

    expect(data.days).toHaveLength(30);
    expect(data.days.at(0)?.date.getDate()).toBe(26);
    expect(data.days.at(0)?.date.getMonth()).toBe(7);
    expect(data.days.at(-1)?.date.getDate()).toBe(24);
    expect(data.days.at(-1)?.date.getMonth()).toBe(8);
    expect(data.days.every((day) => day.count === 0)).toBe(true);
    expect(data.total).toBe(0);
  });

  it("counts records on user-local day boundaries", () => {
    const now = new Date(2026, 8, 24, 0, 0, 0, 0);
    const yesterdayEnd = new Date(2026, 8, 23, 23, 59, 59, 999);
    const todayStart = new Date(2026, 8, 24, 0, 0, 0, 0);
    const data = buildHeatmapData(
      [journalAt(yesterdayEnd), journalAt(todayStart), journalAt(todayStart)],
      now,
    );

    expect(data.days.at(-2)?.count).toBe(1);
    expect(data.days.at(-1)?.count).toBe(2);
    expect(data.total).toBe(3);
  });

  it("keeps counting journals whose bean has been deleted", () => {
    const now = new Date(2026, 8, 24, 12);
    const data = buildHeatmapData([journalAt(now)], now);

    expect(data.days.at(-1)?.count).toBe(1);
    expect(data.days.at(-1)?.level).toBe(1);
  });
});
