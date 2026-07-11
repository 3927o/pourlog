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
  atSeconds: number;
  targetWaterGrams: number;
  note: string;
}

export interface RecipeContent {
  method: BrewMethod;
  coffeeGrams: number;
  brewWaterGrams: number;
  iceGrams: number;
  grind: string;
  temperatureC: number | null;
  durationSeconds: number;
  pour: string;
  steps: PourStep[];
}

export interface SavedRecipe extends RecipeContent {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source?: {
    type: "manual" | "ai" | "journal";
    sourceId?: string;
  };
  needsReview?: boolean;
}

export interface RecipeSnapshot extends RecipeContent {
  name: string;
  source: {
    type: "saved-recipe" | "best-journal" | "manual" | "legacy";
    sourceId?: string;
  };
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
  bestJournalId?: string;
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

export interface AiSuggestion {
  id: string;
  beanId: string;
  method: BrewMethod;
  content: RecipeContent;
  why: string;
  source: "ai" | "local";
  generatedAt: number;
  beanFingerprint: string;
  savedRecipeId?: string;
}

export interface Journal {
  id: string;
  beanId: string;
  createdAt: number;
  recipeSnapshot: RecipeSnapshot;
  dims: BrewDimensions;
  notes: string;
  aiReview?: AnalysisResult;
  savedAsRecipeId?: string;
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
  description: string;
  detail: string;
  levels: [string, string, string, string, string];
  levelDescriptions: [string, string, string, string, string];
}> = [
  {
    key: "acid",
    name: "酸度",
    description: "感受酸质的强弱和明亮程度，不代表分数越高越好。",
    detail:
      "关注酸质在入口、降温和回味中的强度与形态。好的酸可以明亮、活泼并让风味更立体；当酸感尖锐、刺激或盖过甜感时，才可能意味着萃取不足或参数需要调整。",
    levels: ["平淡", "柔和", "平衡", "明亮", "尖锐"],
    levelDescriptions: [
      "几乎感受不到酸质，整体偏平或缺少活力。",
      "酸感轻柔，不抢味，主要在降温后略有显现。",
      "酸甜协调，酸质清楚但不会压过其他风味。",
      "酸质鲜明活泼，能明显提亮花香或果香。",
      "酸感刺激、尖锐，容易压过甜感并让口腔紧缩。",
    ],
  },
  {
    key: "sweet",
    name: "甜感",
    description: "咖啡入口到回味中可感知的自然甜味强度。",
    detail:
      "甜感不是加糖后的甜度，而是咖啡中类似蜂蜜、焦糖、熟果或蔗糖的自然感受。可以分别留意入口时的圆润感、吞咽后的回甘，以及降温后甜味是否变得更清楚。",
    levels: ["无甜", "微甜", "清晰", "甜润", "浓郁"],
    levelDescriptions: [
      "几乎没有自然甜味，风味显得空、酸或苦。",
      "能捕捉到轻微甜感，但停留时间较短。",
      "甜味容易辨认，并能与酸苦形成平衡。",
      "从入口到回味都有连续、圆润的甜感。",
      "甜感集中且饱满，类似熟果、蜂蜜或糖浆。",
    ],
  },
  {
    key: "bitter",
    name: "苦味",
    description: "烘焙和萃取带来的苦感强度，不等同于醇厚度。",
    detail:
      "判断苦味时要把它与深色烘焙香、可可感和厚重口感区分开。适量苦味可以支撑结构；焦苦、干涩或长时间黏在舌根的苦感，通常更值得关注。",
    levels: ["无苦", "轻微", "适中", "明显", "强烈"],
    levelDescriptions: [
      "几乎没有苦味，结构可能偏轻。",
      "只有轻微苦感，为甜味和香气提供一点支撑。",
      "苦味清楚但协调，不会遮盖主要风味。",
      "苦感突出，开始压缩甜感或让回味偏干。",
      "焦苦、药感或干涩明显，并长时间停留。",
    ],
  },
  {
    key: "clean",
    name: "干净度",
    description: "风味是否清晰、分明，是否有浑浊或杂味。",
    detail:
      "干净度关注不同风味能否被清楚辨认，以及从入口到回味是否存在混浊、粉感、发酵杂味或不舒服的涩感。它与风味数量无关，简单但清晰的咖啡也可以很干净。",
    levels: ["浑浊", "略杂", "尚可", "清晰", "通透"],
    levelDescriptions: [
      "风味混在一起，并伴随明显杂味或粉感。",
      "主体可辨认，但仍有轻微浑浊、涩感或干扰。",
      "大部分风味能辨认，偶尔出现不够利落的部分。",
      "风味边界清楚，入口和回味都较少杂味。",
      "风味非常透明、分明，口腔感受利落而纯净。",
    ],
  },
  {
    key: "finish",
    name: "余韵",
    description: "咽下后风味在口中停留的时长和清晰度。",
    detail:
      "吞咽后暂停几秒，观察香气、甜感和主体风味是否继续存在，以及它们是逐渐消退还是被苦涩取代。余韵不仅看时长，也看留下来的感受是否清楚、舒服。",
    levels: ["短促", "较短", "适中", "持久", "绵长"],
    levelDescriptions: [
      "吞咽后风味很快消失，几乎没有延续。",
      "短暂留下少量香气或甜感，随后快速减弱。",
      "主要风味能维持一段时间，消退过程自然。",
      "香气或甜感持续明显，吞咽后仍容易辨认。",
      "风味长时间延续且层次清楚，结束得舒适完整。",
    ],
  },
  {
    key: "body",
    name: "醇厚度",
    description: "咖啡液在口中的重量、黏稠度和包裹感。",
    detail:
      "醇厚度描述咖啡液的触感，而不是浓度高低或苦味强弱。可以想象它更接近水、茶、牛奶还是糖浆，并留意液体是否有顺滑、油润或包裹口腔的感觉。",
    levels: ["水感", "轻盈", "中等", "饱满", "厚重"],
    levelDescriptions: [
      "触感接近水，缺少重量和包裹感。",
      "像清茶一样轻巧，流动快但不显空。",
      "有适中的重量与顺滑感，容易保持平衡。",
      "口感圆润饱满，能明显包裹舌面。",
      "质地浓稠厚实，接近糖浆或厚重奶感。",
    ],
  },
];

export function formatRatio(content: RecipeContent) {
  const ratio =
    (content.brewWaterGrams + content.iceGrams) / content.coffeeGrams;
  return Number.isFinite(ratio) ? ratio.toFixed(1).replace(/\.0$/, "") : "—";
}

export function formatDuration(seconds: number) {
  if (seconds >= 3600) {
    const hours = seconds / 3600;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatTemperature(value: number | null) {
  return value === null ? "冷水 / 室温水" : `${value}°C`;
}

export function cloneRecipeContent(content: RecipeContent): RecipeContent {
  return {
    ...content,
    steps: content.steps.map((step) => ({ ...step })),
  };
}

export function recipeSnapshotFrom(
  recipe: SavedRecipe,
  sourceType: RecipeSnapshot["source"]["type"] = "saved-recipe",
): RecipeSnapshot {
  return {
    name: recipe.name,
    ...cloneRecipeContent(recipe),
    source: { type: sourceType, sourceId: recipe.id },
  };
}

export function beanFingerprint(bean: Bean) {
  return JSON.stringify([
    bean.name,
    bean.origin,
    bean.process,
    bean.roast,
    bean.roastDate,
    bean.flavors,
  ]);
}
