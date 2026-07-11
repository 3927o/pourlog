export type BrewMethod = "热冲" | "冰冲" | "冷萃";

export interface BrewDimensions {
  acid: number;
  sweet: number;
  bitter: number;
  clean: number;
  finish: number;
  body: number;
}

export interface PourStep {
  t: string;
  water: string;
  note: string;
}

export interface Recipe {
  id: string;
  name: string;
  method: BrewMethod;
  ratio: string;
  grind: string;
  temp: string;
  pour: string;
  time: string;
  steps: PourStep[];
  preset: boolean;
}

export interface Bean {
  id: string;
  no: string;
  name: string;
  origin: string;
  process: string;
  roast: string;
  roastDate: string;
  flavors: string[];
  bestRecipeId?: string;
}

export interface AnalysisResult {
  variable: string;
  from: string;
  to: string;
  reason: string;
  principle: string;
  advanced: string[];
  source: "ai" | "local";
}

export interface RecipeSuggestion {
  ratio: string;
  grind: string;
  temp: string;
  time: string;
  steps: PourStep[];
  why: string;
  source: "ai" | "local";
}

export interface Journal {
  id: string;
  beanId: string;
  recipeId: string;
  recipeSnapshot: Recipe;
  createdAt: number;
  dims: BrewDimensions;
  notes: string;
  aiReview?: AnalysisResult;
}

export interface AppSettings {
  id: "main";
  apiBase: string;
  apiKey: string;
  model: string;
}

export const dimensionMeta: Array<{
  key: keyof BrewDimensions;
  name: string;
  lo: string;
  hi: string;
}> = [
  { key: "acid", name: "酸度", lo: "平淡", hi: "明亮" },
  { key: "sweet", name: "甜感", lo: "寡淡", hi: "甜润" },
  { key: "bitter", name: "苦味", lo: "无苦", hi: "明显" },
  { key: "clean", name: "干净度", lo: "浑浊", hi: "清澈" },
  { key: "finish", name: "余韵", lo: "短促", hi: "持久" },
  { key: "body", name: "醇厚度", lo: "水感稀薄", hi: "饱满挂杯" },
];
