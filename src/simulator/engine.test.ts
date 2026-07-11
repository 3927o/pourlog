import { describe, expect, it } from "vitest";
import { initialState, presets, taste } from "./engine";

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
});
