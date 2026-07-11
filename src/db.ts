import Dexie, { type EntityTable, type Transaction } from "dexie";
import type {
  AiSuggestion,
  AppSettings,
  Bean,
  BrewMethod,
  Journal,
  RecipeContent,
  RecipeSnapshot,
  SavedRecipe,
} from "./models";
import { cloneRecipeContent } from "./models";

interface MetaRecord {
  id: "seeded";
  completedAt: number;
}

interface LegacyStep {
  t?: string;
  water?: string;
  note?: string;
}

interface LegacyRecipe {
  id?: string;
  name?: string;
  method?: BrewMethod;
  ratio?: string;
  grind?: string;
  temp?: string;
  pour?: string;
  time?: string;
  steps?: LegacyStep[];
}

interface LegacyJournal {
  id: string;
  beanId: string;
  recipeId?: string;
  recipeSnapshot?: LegacyRecipe;
  createdAt: number;
  dims: Journal["dims"];
  notes: string;
  aiReview?: Journal["aiReview"];
}

interface LegacyBean extends Omit<Bean, "bestJournalId"> {
  bestRecipeId?: string;
}

const LEGACY_BUILTIN_DEFAULTS: Record<
  string,
  { ratio: number; lastWater: number; weights: [number, number, number] }
> = {
  v60: { ratio: 15, lastWater: 250, weights: [16.7, 250, 0] },
  one: { ratio: 16, lastWater: 250, weights: [15.6, 250, 0] },
  ice: { ratio: 15, lastWater: 160, weights: [15, 160, 65] },
  mine: { ratio: 16, lastWater: 240, weights: [15, 240, 0] },
};

function parseClock(value = "") {
  const hours = value.match(/^\s*(\d+(?:\.\d+)?)\s*[hH时]/);
  if (hours) return Math.round(Number(hours[1]) * 3600);
  const clock = value.match(/(\d+)\s*[:：]\s*(\d+)/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*(?:min|分钟)/i);
  return minutes ? Math.round(Number(minutes[1]) * 60) : null;
}

function parseTemperature(value = "") {
  if (/冷水|室温/.test(value)) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseRatio(value = "") {
  const match = value.match(/1\s*[:：]\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function lastNumber(value = "") {
  const matches = [...value.matchAll(/\d+(?:\.\d+)?/g)];
  return matches.length ? Number(matches.at(-1)![0]) : null;
}

export function migrateLegacyRecipe(
  legacy: LegacyRecipe,
  options: { now?: number } = {},
): SavedRecipe {
  const now = options.now ?? Date.now();
  const method = legacy.method ?? "热冲";
  const steps = (legacy.steps ?? [])
    .map((step) => ({
      atSeconds: parseClock(step.t) ?? 0,
      targetWaterGrams: lastNumber(step.water) ?? 0,
      note: step.note ?? "",
    }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
  const lastWater = steps.at(-1)?.targetWaterGrams || null;
  const ratio = parseRatio(legacy.ratio);
  const builtin = legacy.id ? LEGACY_BUILTIN_DEFAULTS[legacy.id] : undefined;
  const explicit =
    builtin && ratio === builtin.ratio && lastWater === builtin.lastWater
      ? builtin.weights
      : undefined;
  const brewWaterGrams =
    explicit?.[1] ?? lastWater ?? (ratio ? 15 * ratio : 240);
  const coffeeGrams = explicit?.[0] ?? (ratio ? brewWaterGrams / ratio : 15);
  const iceGrams = explicit?.[2] ?? 0;
  const parsedTemp = parseTemperature(legacy.temp);
  const parsedDuration = parseClock(legacy.time);
  const coldWater = method === "冷萃" && /冷水|室温/.test(legacy.temp ?? "");
  const ambiguousIce = method === "冰冲" && !explicit;
  const needsReview =
    !ratio ||
    !lastWater ||
    parsedDuration === null ||
    (!coldWater && parsedTemp === null) ||
    ambiguousIce;

  return {
    id: legacy.id ?? uid(),
    name: legacy.name?.trim() || "未命名配方",
    method,
    coffeeGrams: Number(coffeeGrams.toFixed(1)),
    brewWaterGrams,
    iceGrams,
    grind: legacy.grind ?? "中细",
    temperatureC: parsedTemp,
    durationSeconds: parsedDuration ?? (method === "冷萃" ? 36000 : 150),
    pour: legacy.pour ?? "",
    steps,
    createdAt: now,
    updatedAt: now,
    source: { type: "manual" },
    needsReview: needsReview || undefined,
  };
}

function snapshotFromLegacy(recipe: LegacyRecipe | undefined): RecipeSnapshot {
  const migrated = migrateLegacyRecipe(recipe ?? {}, { now: Date.now() });
  return {
    name: migrated.name,
    ...cloneRecipeContent(migrated),
    source: { type: "legacy", sourceId: recipe?.id },
  };
}

class PourlogDB extends Dexie {
  beans!: EntityTable<Bean, "id">;
  recipes!: EntityTable<SavedRecipe, "id">;
  journals!: EntityTable<Journal, "id">;
  aiSuggestions!: EntityTable<AiSuggestion, "id">;
  settings!: EntityTable<AppSettings, "id">;
  meta!: EntityTable<MetaRecord, "id">;

  constructor() {
    super("pourlog");
    this.version(1).stores({
      beans: "id, no, name",
      recipes: "id, preset, method",
      journals: "id, beanId, recipeId, createdAt",
      settings: "id",
    });
    this.version(2).stores({
      beans: "id, no, name",
      recipes: "id, preset, method",
      journals: "id, beanId, recipeId, createdAt",
      settings: "id",
      meta: "id",
    });
    this.version(3)
      .stores({
        beans: "id, no, name, bestJournalId",
        recipes: "id, kind, method, updatedAt",
        journals: "id, beanId, createdAt, savedAsRecipeId",
        aiSuggestions:
          "id, beanId, [beanId+method], generatedAt, savedRecipeId",
        settings: "id",
        meta: "id",
      })
      .upgrade(async (transaction) => migrateVersion3(transaction));
    this.version(4)
      .stores({
        beans: "id, no, name, bestJournalId",
        recipes: "id, method, updatedAt",
        journals: "id, beanId, createdAt, savedAsRecipeId",
        aiSuggestions:
          "id, beanId, [beanId+method], generatedAt, savedRecipeId",
        settings: "id",
        meta: "id",
      })
      .upgrade(async (transaction) => migrateVersion4(transaction));
  }
}

async function migrateVersion4(transaction: Transaction) {
  await transaction
    .table("recipes")
    .toCollection()
    .modify((recipe: Record<string, unknown>) => {
      delete recipe.kind;
      const source = recipe.source as { type?: string } | undefined;
      if (source?.type === "preset-copy") source.type = "manual";
    });
  await transaction
    .table("journals")
    .toCollection()
    .modify((journal: Record<string, unknown>) => {
      const snapshot = journal.recipeSnapshot as
        { source?: { type?: string } } | undefined;
      if (snapshot?.source?.type === "user-recipe") {
        snapshot.source.type = "saved-recipe";
      }
    });
}

async function migrateVersion3(transaction: Transaction) {
  const recipesTable = transaction.table("recipes");
  const journalsTable = transaction.table("journals");
  const beansTable = transaction.table("beans");
  const legacyRecipes = (await recipesTable.toArray()) as LegacyRecipe[];
  const migratedRecipes = legacyRecipes.map((recipe) =>
    migrateLegacyRecipe(recipe, { now: Date.now() }),
  );
  await recipesTable.clear();
  await recipesTable.bulkPut(migratedRecipes);

  const legacyJournals = (await journalsTable.toArray()) as LegacyJournal[];
  const migratedJournals: Journal[] = legacyJournals.map((journal) => ({
    id: journal.id,
    beanId: journal.beanId,
    createdAt: journal.createdAt,
    recipeSnapshot: snapshotFromLegacy(journal.recipeSnapshot),
    dims: journal.dims,
    notes: journal.notes,
    aiReview: journal.aiReview,
  }));
  await journalsTable.clear();
  await journalsTable.bulkPut(migratedJournals);

  const legacyBeans = (await beansTable.toArray()) as LegacyBean[];
  await Promise.all(
    legacyBeans.map(async (bean) => {
      const matches = legacyJournals
        .filter(
          (journal) =>
            journal.beanId === bean.id &&
            journal.recipeId === bean.bestRecipeId,
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      const name =
        bean.id === "yr" && bean.name === "耶加雪菲"
          ? "示例 耶加雪菲"
          : bean.id === "hl" && bean.name === "慧兰"
            ? "示例 慧兰"
            : bean.id === "gs" && bean.name === "瑰夏"
              ? "示例 瑰夏"
              : bean.name;
      const { bestRecipeId: _bestRecipeId, ...rest } = bean;
      await beansTable.put({
        ...rest,
        name,
        bestJournalId: matches[0]?.id,
      });
    }),
  );
}

export const db = new PourlogDB();

const now = Date.now();
const recipes: SavedRecipe[] = [
  {
    id: "v60",
    name: "经典 V60 三段式",
    method: "热冲",
    coffeeGrams: 16.7,
    brewWaterGrams: 250,
    iceGrams: 0,
    grind: "中细",
    temperatureC: 92,
    durationSeconds: 150,
    pour: "三段注水",
    steps: [
      { atSeconds: 0, targetWaterGrams: 40, note: "闷蒸" },
      { atSeconds: 30, targetWaterGrams: 180, note: "第二段绕圈" },
      { atSeconds: 75, targetWaterGrams: 250, note: "收尾" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "one",
    name: "一刀流",
    method: "热冲",
    coffeeGrams: 15.6,
    brewWaterGrams: 250,
    iceGrams: 0,
    grind: "中细",
    temperatureC: 90,
    durationSeconds: 120,
    pour: "单段一刀",
    steps: [{ atSeconds: 0, targetWaterGrams: 250, note: "一次匀速注满" }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "ice",
    name: "冰手冲",
    method: "冰冲",
    coffeeGrams: 15,
    brewWaterGrams: 160,
    iceGrams: 65,
    grind: "中细",
    temperatureC: 93,
    durationSeconds: 140,
    pour: "冰上萃取",
    steps: [
      { atSeconds: 0, targetWaterGrams: 30, note: "闷蒸（壶下放冰）" },
      { atSeconds: 20, targetWaterGrams: 160, note: "注在冰上快速降温" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "mine",
    name: "我的耶加配方",
    method: "热冲",
    coffeeGrams: 15,
    brewWaterGrams: 240,
    iceGrams: 0,
    grind: "中细偏细",
    temperatureC: 88,
    durationSeconds: 135,
    pour: "三段注水",
    steps: [
      { atSeconds: 0, targetWaterGrams: 36, note: "闷蒸" },
      { atSeconds: 35, targetWaterGrams: 150, note: "第二段" },
      { atSeconds: 80, targetWaterGrams: 240, note: "收尾" },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

const beans: Bean[] = [
  {
    id: "yr",
    no: "01",
    name: "示例 耶加雪菲",
    origin: "埃塞俄比亚 · 科契尔",
    process: "水洗",
    roast: "浅烘",
    roastDate: "06.28",
    flavors: ["柑橘", "茉莉", "红茶"],
    bestJournalId: "j1",
  },
  {
    id: "hl",
    no: "02",
    name: "示例 慧兰",
    origin: "哥伦比亚 · 惠兰",
    process: "水洗",
    roast: "中烘",
    roastDate: "06.20",
    flavors: ["焦糖", "坚果", "橙皮"],
  },
  {
    id: "gs",
    no: "03",
    name: "示例 瑰夏",
    origin: "巴拿马 · 翡翠庄园",
    process: "日晒",
    roast: "浅烘",
    roastDate: "07.02",
    flavors: ["白花", "荔枝", "蜂蜜"],
  },
];

const defaultSettings: AppSettings = {
  id: "main",
  apiBase: "",
  apiKey: "",
  model: "gpt-4o-mini",
};

function snapshot(recipe: SavedRecipe): RecipeSnapshot {
  return {
    name: recipe.name,
    ...cloneRecipeContent(recipe),
    source: {
      type: "saved-recipe",
      sourceId: recipe.id,
    },
  };
}

export async function seedDatabase() {
  const [seeded, beanCount, recipeCount, journalCount, settings] =
    await Promise.all([
      db.meta.get("seeded"),
      db.beans.count(),
      db.recipes.count(),
      db.journals.count(),
      db.settings.get("main"),
    ]);
  if (seeded) return;
  if (beanCount || recipeCount || journalCount || settings) {
    await db.transaction("rw", db.settings, db.meta, async () => {
      if (!settings) await db.settings.add(defaultSettings);
      await db.meta.put({ id: "seeded", completedAt: Date.now() });
    });
    return;
  }
  await db.transaction(
    "rw",
    db.beans,
    db.recipes,
    db.journals,
    db.settings,
    db.meta,
    async () => {
      await db.recipes.bulkAdd(recipes);
      await db.beans.bulkAdd(beans);
      const journalRows: Journal[] = [
        {
          id: "j1",
          beanId: "yr",
          recipeSnapshot: snapshot(recipes[3]!),
          createdAt: now - 6 * 86400000,
          dims: { acid: 4, sweet: 4, bitter: 2, clean: 5, finish: 4, body: 3 },
          notes: "花香很清楚，尾段回甘明显。",
        },
        {
          id: "j2",
          beanId: "yr",
          recipeSnapshot: snapshot(recipes[0]!),
          createdAt: now - 10 * 86400000,
          dims: { acid: 5, sweet: 3, bitter: 2, clean: 4, finish: 3, body: 3 },
          notes: "酸偏尖，可以再柔和些。",
        },
        {
          id: "j3",
          beanId: "hl",
          recipeSnapshot: snapshot(recipes[0]!),
          createdAt: now - 11 * 86400000,
          dims: { acid: 3, sweet: 4, bitter: 3, clean: 4, finish: 3, body: 4 },
          notes: "",
        },
        {
          id: "j4",
          beanId: "gs",
          recipeSnapshot: snapshot(recipes[1]!),
          createdAt: now - 5 * 86400000,
          dims: { acid: 4, sweet: 5, bitter: 1, clean: 4, finish: 5, body: 3 },
          notes: "花果香炸裂。",
        },
      ];
      await db.journals.bulkAdd(journalRows);
      await db.settings.add(defaultSettings);
      await db.meta.add({ id: "seeded", completedAt: now });
    },
  );
}

export async function deleteBean(beanId: string) {
  await db.transaction(
    "rw",
    db.beans,
    db.journals,
    db.aiSuggestions,
    async () => {
      await db.journals.where("beanId").equals(beanId).delete();
      await db.aiSuggestions.where("beanId").equals(beanId).delete();
      await db.beans.delete(beanId);
    },
  );
}

export async function deleteJournal(journal: Journal) {
  await db.transaction("rw", db.beans, db.journals, async () => {
    const bean = await db.beans.get(journal.beanId);
    if (bean?.bestJournalId === journal.id)
      await db.beans.update(bean.id, { bestJournalId: undefined });
    await db.journals.delete(journal.id);
  });
}

export async function deleteRecipe(recipeId: string) {
  await db.transaction(
    "rw",
    db.recipes,
    db.aiSuggestions,
    db.journals,
    async () => {
      const recipe = await db.recipes.get(recipeId);
      if (!recipe) return;
      await db.recipes.delete(recipeId);
      await db.aiSuggestions
        .where("savedRecipeId")
        .equals(recipeId)
        .modify({ savedRecipeId: undefined });
      await db.journals
        .where("savedAsRecipeId")
        .equals(recipeId)
        .modify({ savedAsRecipeId: undefined });
    },
  );
}

export async function saveContentAsRecipe(
  name: string,
  content: RecipeContent,
  source: SavedRecipe["source"],
) {
  const timestamp = Date.now();
  const recipe: SavedRecipe = {
    id: uid(),
    name,
    ...cloneRecipeContent(content),
    createdAt: timestamp,
    updatedAt: timestamp,
    source,
  };
  await db.recipes.add(recipe);
  return recipe;
}

export async function nextBeanNumber() {
  const allBeans = await db.beans.toArray();
  const highest = allBeans.reduce(
    (max, bean) => Math.max(max, Number.parseInt(bean.no, 10) || 0),
    0,
  );
  return String(highest + 1).padStart(2, "0");
}

export const uid = () => Math.random().toString(36).slice(2, 10);
