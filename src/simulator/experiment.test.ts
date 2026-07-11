import { describe, expect, it } from "vitest";
import type { AnalysisResult, Bean, RecipeContent } from "../models";
import {
  buildExperimentPlan,
  experimentImpacts,
  recipeToBrewDimensions,
  recipeToSimulatorState,
  simulatorSupportsRecipe,
} from "./experiment";

const bean: Bean = {
  id: "bean",
  no: "01",
  name: "测试豆",
  origin: "测试产区",
  process: "水洗",
  roast: "浅烘",
  roastDate: "07.11",
  flavors: ["柑橘"],
};

const recipe: RecipeContent = {
  method: "热冲",
  coffeeGrams: 15,
  brewWaterGrams: 240,
  iceGrams: 0,
  grind: "中细",
  temperatureC: 92,
  durationSeconds: 150,
  pour: "三段注水",
  steps: [
    { atSeconds: 0, targetWaterGrams: 40, note: "闷蒸" },
    { atSeconds: 30, targetWaterGrams: 150, note: "第二段" },
    { atSeconds: 70, targetWaterGrams: 240, note: "收尾" },
  ],
};

function review(partial: Partial<AnalysisResult>): AnalysisResult {
  return {
    variable: "研磨",
    from: "中细",
    to: "中细（略细）",
    reason: "提高萃取，观察甜感是否增加。",
    principle: "只改一个变量。",
    advanced: [],
    source: "local",
    ...partial,
  };
}

describe("journal experiment mapping", () => {
  it("uses the journal recipe as the simulator baseline", () => {
    const state = recipeToSimulatorState(bean, recipe);

    expect(state.roast).toBe("light");
    expect(state.process).toBe("washed");
    expect(state.temp).toBe(92);
    expect(state.ratio).toBe(160);
    expect(state.bloom).toBe("b30");
    expect(state.pours).toBe("p3");
  });

  it("changes only grind for a finer-grind experiment", () => {
    const plan = buildExperimentPlan(bean, recipe, review({}));

    expect(plan.supported).toBe(true);
    expect(plan.control).toBe("grind");
    expect(plan.candidate.grind - plan.baseline.grind).toBe(3);
    expect({ ...plan.candidate, grind: plan.baseline.grind }).toEqual(
      plan.baseline,
    );
  });

  it("uses one impact calculation for the journal and lab preview", () => {
    const plan = buildExperimentPlan(bean, recipe, review({}));
    const impacts = experimentImpacts(plan);

    expect(impacts.map((impact) => impact.key)).toEqual([
      "acid",
      "sweet",
      "bitter",
      "clarity",
      "body",
      "aftertaste",
    ]);
    expect(impacts.every((impact) => Number.isFinite(impact.delta))).toBe(true);
  });

  it("maps simulator taste values onto the journal's 1-5 scale", () => {
    const dims = recipeToBrewDimensions(bean, recipe);

    expect(Object.values(dims)).toHaveLength(6);
    expect(Object.values(dims).every((value) => value >= 1 && value <= 5)).toBe(
      true,
    );
  });

  it("refuses to run iced pour-over or cold brew through the hot-brew model", () => {
    for (const method of ["冰冲", "冷萃"] as const) {
      const unsupportedRecipe = { ...recipe, method };

      expect(simulatorSupportsRecipe(unsupportedRecipe)).toBe(false);
      expect(() => recipeToSimulatorState(bean, unsupportedRecipe)).toThrow(
        "当前只支持热冲",
      );
    }
  });

  it("maps a ratio recommendation to the ratio control", () => {
    const plan = buildExperimentPlan(
      bean,
      recipe,
      review({ variable: "粉水比", from: "1:16", to: "1:15" }),
    );

    expect(plan.control).toBe("ratio");
    expect(plan.candidate.ratio).toBe(150);
  });

  it("does not invent a change for an unsupported variable", () => {
    const plan = buildExperimentPlan(
      bean,
      recipe,
      review({ variable: "滤杯", from: "V60", to: "蛋糕杯" }),
    );

    expect(plan.supported).toBe(false);
    expect(plan.candidate).toEqual(plan.baseline);
  });
});
