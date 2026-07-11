import { describe, expect, it } from "vitest";
import { character, initialState, presets, taste } from "./engine";

describe("simulator engine", () => {
  it.each(presets)(
    "keeps preset $name within physical output bounds",
    ({ value }) => {
      const result = taste(value);

      for (const metric of Object.values(result)) {
        if (typeof metric === "number")
          expect(Number.isFinite(metric)).toBe(true);
      }
      expect(result.ey).toBeGreaterThanOrEqual(12);
      expect(result.ey).toBeLessThanOrEqual(29);
      expect(result.uni).toBeGreaterThanOrEqual(2);
      expect(result.uni).toBeLessThanOrEqual(98);
      expect(result.timeSec).toBeGreaterThanOrEqual(45);
      expect(result.timeSec).toBeLessThanOrEqual(420);
    },
  );

  it("responds monotonically to a finer grind in the baseline recipe", () => {
    const coarse = taste({ ...initialState, grind: 25 });
    const fine = taste({ ...initialState, grind: 75 });

    expect(fine.ey).toBeGreaterThan(coarse.ey);
    expect(fine.timeSec).toBeGreaterThan(coarse.timeSec);
  });

  it("keeps temperature useful without making it dominate the whole brew", () => {
    const cool = taste({ ...initialState, temp: 85 });
    const hot = taste({ ...initialState, temp: 96 });

    expect(hot.ey).toBeGreaterThan(cool.ey);
    expect(hot.ey - cool.ey).toBeLessThan(4);
  });

  it("raises extraction but lowers concentration when more water is used", () => {
    const concentrated = taste({ ...initialState, ratio: 120 });
    const diluted = taste({ ...initialState, ratio: 180 });

    expect(diluted.ey).toBeGreaterThan(concentrated.ey);
    expect(diluted.tds).toBeLessThan(concentrated.tds);
  });

  it("treats mineral content as a modest extraction modifier", () => {
    const soft = taste({ ...initialState, minerals: 0 });
    const hard = taste({ ...initialState, minerals: 100 });

    expect(hard.ey).toBeGreaterThan(soft.ey);
    expect(hard.ey - soft.ey).toBeLessThan(1.5);
  });

  it("models center pouring as a risk instead of a guaranteed failed cup", () => {
    const centerState = { ...initialState, style: "center" as const };
    const center = taste(centerState);
    const spiral = taste({ ...initialState, style: "spiral" });

    expect(center.uni).toBeGreaterThanOrEqual(58);
    expect(center.uni).toBeLessThan(spiral.uni);
    expect(character(center, centerState).kind).not.toBe("uneven");
  });

  it("classifies the wall-pour preset as diluted rather than a good cup", () => {
    const wall = presets.find((preset) => preset.id === "wall");
    expect(wall).toBeDefined();

    const result = taste(wall!.value);
    const cup = character(result, wall!.value);

    expect(result.bypass).toBeGreaterThanOrEqual(0.08);
    expect(cup.kind).toBe("under");
    expect(cup.headline).toContain("稀释");
  });

  it("keeps the baseline recipe inside the intended balanced zone", () => {
    const result = taste(initialState);

    expect(result.ey).toBeGreaterThanOrEqual(18);
    expect(result.ey).toBeLessThanOrEqual(22);
    expect(result.tds).toBeGreaterThanOrEqual(1.15);
    expect(result.tds).toBeLessThanOrEqual(1.5);
  });
});
