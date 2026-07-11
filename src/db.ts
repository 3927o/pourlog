import Dexie, { type EntityTable } from "dexie";
import type { AppSettings, Bean, Journal, Recipe } from "./models";

class PourlogDB extends Dexie {
  beans!: EntityTable<Bean, "id">;
  recipes!: EntityTable<Recipe, "id">;
  journals!: EntityTable<Journal, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("pourlog");
    this.version(1).stores({
      beans: "id, no, name",
      recipes: "id, preset, method",
      journals: "id, beanId, recipeId, createdAt",
      settings: "id",
    });
  }
}

export const db = new PourlogDB();

const recipes: Recipe[] = [
  {
    id: "v60",
    name: "经典 V60 三段式",
    method: "热冲",
    ratio: "1:15",
    grind: "中细",
    temp: "92°C",
    pour: "三段注水",
    time: "2:30",
    preset: true,
    steps: [
      { t: "0:00", water: "0→40g", note: "闷蒸" },
      { t: "0:30", water: "40→180g", note: "第二段绕圈" },
      { t: "1:15", water: "180→250g", note: "收尾" },
    ],
  },
  {
    id: "one",
    name: "一刀流",
    method: "热冲",
    ratio: "1:16",
    grind: "中细",
    temp: "90°C",
    pour: "单段一刀",
    time: "2:00",
    preset: true,
    steps: [{ t: "0:00", water: "0→250g", note: "一次匀速注满" }],
  },
  {
    id: "ice",
    name: "冰手冲",
    method: "冰冲",
    ratio: "1:15",
    grind: "中细",
    temp: "93°C",
    pour: "冰上萃取",
    time: "2:20",
    preset: true,
    steps: [
      { t: "0:00", water: "0→30g", note: "闷蒸（壶下放冰）" },
      { t: "0:20", water: "30→160g", note: "注在冰上快速降温" },
    ],
  },
  {
    id: "mine",
    name: "我的耶加配方",
    method: "热冲",
    ratio: "1:16",
    grind: "中细偏细",
    temp: "88°C",
    pour: "三段注水",
    time: "2:15",
    preset: false,
    steps: [
      { t: "0:00", water: "0→36g", note: "闷蒸" },
      { t: "0:35", water: "36→150g", note: "第二段" },
      { t: "1:20", water: "150→240g", note: "收尾" },
    ],
  },
];

const beans: Bean[] = [
  {
    id: "yr",
    no: "01",
    name: "耶加雪菲",
    origin: "埃塞俄比亚 · 科契尔",
    process: "水洗",
    roast: "浅烘",
    roastDate: "06.28",
    flavors: ["柑橘", "茉莉", "红茶"],
    bestRecipeId: "mine",
  },
  {
    id: "hl",
    no: "02",
    name: "慧兰",
    origin: "哥伦比亚 · 惠兰",
    process: "水洗",
    roast: "中烘",
    roastDate: "06.20",
    flavors: ["焦糖", "坚果", "橙皮"],
  },
  {
    id: "gs",
    no: "03",
    name: "瑰夏",
    origin: "巴拿马 · 翡翠庄园",
    process: "日晒",
    roast: "浅烘",
    roastDate: "07.02",
    flavors: ["白花", "荔枝", "蜂蜜"],
  },
];

export async function seedDatabase() {
  const [beanCount, recipeCount, journalCount, settings] = await Promise.all([
    db.beans.count(),
    db.recipes.count(),
    db.journals.count(),
    db.settings.get("main"),
  ]);
  if (beanCount && recipeCount && journalCount && settings) return;
  await db.transaction(
    "rw",
    db.beans,
    db.recipes,
    db.journals,
    db.settings,
    async () => {
      if (!recipeCount) await db.recipes.bulkAdd(recipes);
      if (!beanCount) await db.beans.bulkAdd(beans);
      const now = Date.now();
      if (!journalCount)
        await db.journals.bulkAdd([
          {
            id: "j1",
            beanId: "yr",
            recipeId: "mine",
            recipeSnapshot: recipes[3]!,
            createdAt: now - 6 * 86400000,
            dims: {
              acid: 4,
              sweet: 4,
              bitter: 2,
              clean: 5,
              finish: 4,
              body: 3,
            },
            notes: "花香很清楚，尾段回甘明显。",
          },
          {
            id: "j2",
            beanId: "yr",
            recipeId: "v60",
            recipeSnapshot: recipes[0]!,
            createdAt: now - 10 * 86400000,
            dims: {
              acid: 5,
              sweet: 3,
              bitter: 2,
              clean: 4,
              finish: 3,
              body: 3,
            },
            notes: "酸偏尖，可以再柔和些。",
          },
          {
            id: "j3",
            beanId: "hl",
            recipeId: "v60",
            recipeSnapshot: recipes[0]!,
            createdAt: now - 11 * 86400000,
            dims: {
              acid: 3,
              sweet: 4,
              bitter: 3,
              clean: 4,
              finish: 3,
              body: 4,
            },
            notes: "",
          },
          {
            id: "j4",
            beanId: "gs",
            recipeId: "one",
            recipeSnapshot: recipes[1]!,
            createdAt: now - 5 * 86400000,
            dims: {
              acid: 4,
              sweet: 5,
              bitter: 1,
              clean: 4,
              finish: 5,
              body: 3,
            },
            notes: "花果香炸裂。",
          },
        ]);
      if (!settings)
        await db.settings.add({
          id: "main",
          apiBase: "",
          apiKey: "",
          model: "gpt-4o-mini",
        });
    },
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10);
