import type {
  AnalysisResult,
  Bean,
  BrewDimensions,
  RecipeContent,
} from "../models";
import { initialState, taste, type SimulatorState } from "./engine";

export interface ExperimentPlan {
  baseline: SimulatorState;
  candidate: SimulatorState;
  control: keyof SimulatorState | null;
  supported: boolean;
}

export interface ExperimentImpact {
  key: "acid" | "sweet" | "bitter" | "clarity" | "body" | "aftertaste";
  label: string;
  before: number;
  after: number;
  delta: number;
}

const impactMetrics: Array<Pick<ExperimentImpact, "key" | "label">> = [
  { key: "acid", label: "酸" },
  { key: "sweet", label: "甜" },
  { key: "bitter", label: "苦" },
  { key: "clarity", label: "干净" },
  { key: "body", label: "醇厚" },
  { key: "aftertaste", label: "余韵" },
];

export function simulatorSupportsRecipe(recipe: RecipeContent) {
  return recipe.method === "热冲";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function grindValue(label: string) {
  if (/极粗/.test(label)) return 18;
  if (/中细偏粗/.test(label)) return 46;
  if (/中细偏细/.test(label)) return 62;
  if (/中粗/.test(label)) return 38;
  if (/中细/.test(label)) return 54;
  if (/粗/.test(label)) return 28;
  if (/细/.test(label)) return 70;
  return initialState.grind;
}

function pourCount(recipe: RecipeContent): SimulatorState["pours"] {
  const pouringSteps = recipe.steps.filter(
    (step) => step.targetWaterGrams > 0 && !/闷蒸/.test(step.note),
  ).length;
  if (pouringSteps >= 4 || /五段|4:6/.test(recipe.pour)) return "p5";
  if (pouringSteps <= 1 || /一刀|一次/.test(recipe.pour)) return "p1";
  return "p3";
}

export function recipeToSimulatorState(
  bean: Bean,
  recipe: RecipeContent,
): SimulatorState {
  if (!simulatorSupportsRecipe(recipe)) {
    throw new Error("冲煮实验室当前只支持热冲配方");
  }
  const ratio = (recipe.brewWaterGrams / recipe.coffeeGrams) * 10;
  const bloomStep = recipe.steps.find((step) => /闷蒸/.test(step.note));
  const nextStep = bloomStep
    ? recipe.steps.find((step) => step.atSeconds > bloomStep.atSeconds)
    : undefined;
  const bloomSeconds = nextStep
    ? nextStep.atSeconds - (bloomStep?.atSeconds ?? 0)
    : 0;

  return {
    ...initialState,
    roast: bean.roast.includes("浅")
      ? "light"
      : bean.roast.includes("深")
        ? "dark"
        : "medium",
    process: bean.process.includes("日晒") ? "natural" : "washed",
    grind: grindValue(recipe.grind),
    temp: clamp(recipe.temperatureC ?? initialState.temp, 85, 96),
    ratio: clamp(Math.round(ratio), 120, 180),
    bloom: bloomSeconds >= 38 ? "b45" : bloomSeconds > 0 ? "b30" : "none",
    pours: pourCount(recipe),
  };
}

function lastNumber(value: string) {
  const matches = [...value.matchAll(/\d+(?:\.\d+)?/g)];
  return matches.length ? Number(matches.at(-1)![0]) : null;
}

function adjustedGrind(current: number, analysis: AnalysisResult) {
  const target = analysis.to;
  if (/略细/.test(target)) return clamp(current + 3, 0, 100);
  if (/略粗/.test(target)) return clamp(current - 3, 0, 100);
  const mapped = grindValue(target);
  if (mapped !== initialState.grind || /中细/.test(target)) {
    if (/调细|更细/.test(target))
      return clamp(Math.max(mapped, current + 6), 0, 100);
    if (/调粗|更粗/.test(target))
      return clamp(Math.min(mapped, current - 6), 0, 100);
    return mapped;
  }
  if (/偏细|调细|更细/.test(target)) return clamp(current + 6, 0, 100);
  if (/偏粗|调粗|更粗/.test(target)) return clamp(current - 6, 0, 100);
  return current;
}

export function buildExperimentPlan(
  bean: Bean,
  recipe: RecipeContent,
  analysis: AnalysisResult,
): ExperimentPlan {
  const baseline = recipeToSimulatorState(bean, recipe);
  const candidate = { ...baseline };
  const variable = analysis.variable.replace(/\s/g, "");
  let control: keyof SimulatorState | null = null;

  if (/研磨/.test(variable)) {
    control = "grind";
    candidate.grind = adjustedGrind(baseline.grind, analysis);
  } else if (/水温|温度/.test(variable)) {
    control = "temp";
    const value = lastNumber(analysis.to);
    if (value !== null) candidate.temp = clamp(value, 85, 96);
  } else if (/粉水比|比例/.test(variable)) {
    control = "ratio";
    const value = lastNumber(analysis.to);
    if (value !== null)
      candidate.ratio = clamp(Math.round(value * 10), 120, 180);
  } else if (/闷蒸/.test(variable)) {
    control = "bloom";
    const seconds = lastNumber(analysis.to);
    candidate.bloom =
      seconds === null || seconds <= 0 ? "none" : seconds >= 38 ? "b45" : "b30";
  } else if (/注水段数|段数/.test(variable)) {
    control = "pours";
    const count = lastNumber(analysis.to);
    if (count !== null)
      candidate.pours = count >= 4 ? "p5" : count <= 1 ? "p1" : "p3";
  }

  return {
    baseline,
    candidate,
    control,
    supported: control !== null && candidate[control] !== baseline[control],
  };
}

export function changedExperimentControls(
  baseline: SimulatorState,
  current: SimulatorState,
) {
  return (Object.keys(baseline) as Array<keyof SimulatorState>).filter(
    (key) => baseline[key] !== current[key],
  );
}

export function experimentImpacts(plan: ExperimentPlan): ExperimentImpact[] {
  const baseline = taste(plan.baseline);
  const candidate = taste(plan.candidate);
  return impactMetrics.map(({ key, label }) => {
    const before = Math.round(baseline[key]);
    const after = Math.round(candidate[key]);
    return { key, label, before, after, delta: after - before };
  });
}

function simulatorScore(value: number) {
  return clamp(Math.ceil(value / 20), 1, 5);
}

export function recipeToBrewDimensions(
  bean: Bean,
  recipe: RecipeContent,
): BrewDimensions {
  const result = taste(recipeToSimulatorState(bean, recipe));
  return {
    acid: simulatorScore(result.acid),
    sweet: simulatorScore(result.sweet),
    bitter: simulatorScore(result.bitter),
    clean: simulatorScore(result.clarity),
    finish: simulatorScore(result.aftertaste),
    body: simulatorScore(result.body),
  };
}
