import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { DEFAULT_AI_SETTINGS } from "./aiConfig";
import {
  db,
  deleteBean,
  deleteJournal,
  deleteRecipe,
  markBeanOpened,
  markRecipeOpened,
  migrateLegacyRecipe,
  nextBeanActivityAt,
  nextBeanNumber,
  nextRecipeActivityAt,
  seedDatabase,
  sortByRecentActivity,
} from "./db";
import { recipeToBrewDimensions } from "./simulator/experiment";

describe("database initialization", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.delete();
  });

  it("seeds a brand-new database exactly once", async () => {
    await seedDatabase();

    expect(await db.beans.count()).toBe(3);
    expect(await db.recipes.count()).toBe(4);
    expect(await db.journals.count()).toBe(4);

    await db.journals.clear();
    await seedDatabase();

    expect(await db.journals.count()).toBe(0);
  });

  it("aligns seeded journal dimensions with the simulator", async () => {
    await seedDatabase();
    for (const id of ["j1", "j2", "j3", "j4"]) {
      const journal = await db.journals.get(id);
      const bean = await db.beans.get(journal!.beanId);

      expect(journal!.dims).toEqual(
        recipeToBrewDimensions(bean!, journal!.recipeSnapshot),
      );
    }
  });

  it("marks an existing database without adding demo records", async () => {
    await db.settings.add({
      ...DEFAULT_AI_SETTINGS,
      id: "main",
      apiBase: "",
      apiKey: "",
      model: "local-model",
    });

    await seedDatabase();

    expect(await db.beans.count()).toBe(0);
    expect(await db.recipes.count()).toBe(0);
    expect(await db.journals.count()).toBe(0);
    expect(await db.meta.get("seeded")).toBeDefined();
  });

  it("repairs missing settings without adding demo records", async () => {
    await db.beans.add({
      id: "custom",
      no: "09",
      name: "用户豆子",
      origin: "用户产区",
      process: "水洗",
      roast: "浅烘",
      roastDate: "07.11",
      flavors: [],
    });

    await seedDatabase();

    expect(await db.beans.toArray()).toHaveLength(1);
    expect(await db.recipes.count()).toBe(0);
    expect(await db.settings.get("main")).toBeDefined();
  });

  it("upgrades legacy empty AI settings to the bundled default", async () => {
    await seedDatabase();
    await db.settings.put({
      ...DEFAULT_AI_SETTINGS,
      id: "main",
      apiBase: "",
      apiKey: "",
      model: "gpt-4o-mini",
    });

    await seedDatabase();

    expect(await db.settings.get("main")).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("adds vision settings without changing an existing text AI config", async () => {
    db.close();
    await Dexie.delete("pourlog");
    const legacy = new Dexie("pourlog");
    legacy.version(5).stores({
      beans: "id, no, name, bestJournalId",
      recipes: "id, method, updatedAt",
      journals: "id, beanId, createdAt, savedAsRecipeId",
      aiSuggestions: "id, beanId, [beanId+method], generatedAt, savedRecipeId",
      settings: "id",
      meta: "id",
    });
    await legacy.open();
    await legacy.table("settings").add({
      id: "main",
      apiBase: "https://api.deepseek.com",
      apiKey: "existing-key",
      model: "deepseek-chat",
    });
    legacy.close();

    await db.open();
    const migrated = await db.settings.get("main");

    expect(migrated).toMatchObject({
      apiBase: "https://api.deepseek.com",
      apiKey: "existing-key",
      model: "deepseek-chat",
      visionApiBase: DEFAULT_AI_SETTINGS.visionApiBase,
      visionApiKey: DEFAULT_AI_SETTINGS.visionApiKey,
      visionModel: "qwen3.7-plus",
    });
  });

  it("allocates a number above the highest existing bean number", async () => {
    await seedDatabase();
    await db.beans.delete("hl");

    expect(await nextBeanNumber()).toBe("04");
  });

  it("orders beans and recipes by edits or opens without changing edit times", async () => {
    await seedDatabase();
    await db.beans.update("yr", { updatedAt: 100, lastOpenedAt: undefined });
    await db.beans.update("hl", { updatedAt: 200, lastOpenedAt: undefined });
    await db.beans.update("gs", { updatedAt: 50, lastOpenedAt: undefined });
    await db.recipes.update("v60", { updatedAt: 100, lastOpenedAt: undefined });
    await db.recipes.update("one", { updatedAt: 200, lastOpenedAt: undefined });
    await db.recipes.update("ice", { updatedAt: 50, lastOpenedAt: undefined });
    await db.recipes.update("mine", { updatedAt: 25, lastOpenedAt: undefined });

    const beansByActivity = () =>
      db.beans
        .toArray()
        .then((items) =>
          sortByRecentActivity(items, (a, b) => b.no.localeCompare(a.no)),
        );
    const recipesByActivity = () =>
      db.recipes
        .toArray()
        .then((items) =>
          sortByRecentActivity(items, (a, b) => b.createdAt - a.createdAt),
        );

    expect((await beansByActivity())[0]?.id).toBe("hl");
    expect((await recipesByActivity())[0]?.id).toBe("one");

    await markBeanOpened("yr");
    await markRecipeOpened("v60");

    expect((await beansByActivity())[0]?.id).toBe("yr");
    expect((await recipesByActivity())[0]?.id).toBe("v60");
    expect((await db.beans.get("yr"))?.updatedAt).toBe(100);
    expect((await db.recipes.get("v60"))?.updatedAt).toBe(100);
    expect(await nextBeanActivityAt()).toBeGreaterThan(
      (await db.beans.get("yr"))!.lastOpenedAt!,
    );
    expect(await nextRecipeActivityAt()).toBeGreaterThan(
      (await db.recipes.get("v60"))!.lastOpenedAt!,
    );
  });

  it("backfills update time for beans saved before activity sorting", async () => {
    db.close();
    await Dexie.delete("pourlog");
    const legacy = new Dexie("pourlog");
    legacy.version(6).stores({
      beans: "id, no, name, bestJournalId",
      recipes: "id, method, updatedAt",
      journals: "id, beanId, createdAt, savedAsRecipeId",
      aiSuggestions: "id, beanId, [beanId+method], generatedAt, savedRecipeId",
      settings: "id",
      meta: "id",
    });
    await legacy.open();
    await legacy.table("beans").add({
      id: "old-bean",
      no: "07",
      name: "旧豆子",
      origin: "",
      process: "水洗",
      roast: "浅烘",
      roastDate: "",
      flavors: [],
    });
    legacy.close();

    await db.open();
    expect((await db.beans.get("old-bean"))?.updatedAt).toBe(0);
    await markBeanOpened("old-bean");
    expect((await db.beans.get("old-bean"))?.lastOpenedAt).toBeGreaterThan(0);
  });

  it("converts legacy string fields into structured recipe content", () => {
    const migrated = migrateLegacyRecipe({
      id: "custom",
      name: "旧配方",
      method: "热冲",
      ratio: "1:16",
      grind: "中细",
      temp: "92°C",
      time: "2:30",
      steps: [
        { t: "0:00", water: "0→40g", note: "闷蒸" },
        { t: "1:10", water: "150→240g", note: "收尾" },
      ],
    });

    expect(migrated.coffeeGrams).toBe(15);
    expect(migrated.brewWaterGrams).toBe(240);
    expect(migrated.temperatureC).toBe(92);
    expect(migrated.durationSeconds).toBe(150);
    expect(migrated.steps[1]).toMatchObject({
      atSeconds: 70,
      targetWaterGrams: 240,
    });
    expect(migrated.needsReview).toBeUndefined();
  });

  it("preserves edits made to a legacy built-in recipe", () => {
    const migrated = migrateLegacyRecipe({
      id: "v60",
      name: "修改后的 V60",
      method: "热冲",
      ratio: "1:18",
      grind: "中细",
      temp: "92°C",
      time: "3:00",
      steps: [
        { t: "0:00", water: "0→50g", note: "闷蒸" },
        { t: "1:30", water: "200→300g", note: "收尾" },
      ],
    });

    expect(migrated.coffeeGrams).toBe(16.7);
    expect(migrated.brewWaterGrams).toBe(300);
    expect(migrated.durationSeconds).toBe(180);
  });

  it("keeps malformed legacy content and marks it for review", () => {
    const migrated = migrateLegacyRecipe({
      name: "异常配方",
      method: "冰冲",
      ratio: "随感觉",
      temp: "很热",
      time: "一会儿",
      steps: [],
    });

    expect(migrated.coffeeGrams).toBeGreaterThan(0);
    expect(migrated.brewWaterGrams).toBeGreaterThan(0);
    expect(migrated.needsReview).toBe(true);
  });

  it("clears recipe links without changing journal snapshots", async () => {
    await seedDatabase();
    const original = await db.journals.get("j1");
    await db.aiSuggestions.add({
      id: "yr:热冲",
      beanId: "yr",
      method: "热冲",
      content: original!.recipeSnapshot,
      why: "测试",
      source: "local",
      generatedAt: Date.now(),
      beanFingerprint: "test",
      savedRecipeId: "mine",
    });
    await db.journals.update("j1", { savedAsRecipeId: "mine" });

    await deleteRecipe("mine");

    expect(await db.recipes.get("mine")).toBeUndefined();
    expect(
      (await db.aiSuggestions.get("yr:热冲"))?.savedRecipeId,
    ).toBeUndefined();
    const journal = await db.journals.get("j1");
    expect(journal?.savedAsRecipeId).toBeUndefined();
    expect(journal?.recipeSnapshot).toEqual(original?.recipeSnapshot);
  });

  it("allows every recipe to be deleted", async () => {
    await seedDatabase();

    await deleteRecipe("v60");

    expect(await db.recipes.get("v60")).toBeUndefined();
  });

  it("removes legacy recipe classification during the v4 upgrade", async () => {
    db.close();
    await Dexie.delete("pourlog");
    const legacy = new Dexie("pourlog");
    legacy.version(3).stores({
      beans: "id, no, name, bestJournalId",
      recipes: "id, kind, method, updatedAt",
      journals: "id, beanId, createdAt, savedAsRecipeId",
      aiSuggestions: "id, beanId, [beanId+method], generatedAt, savedRecipeId",
      settings: "id",
      meta: "id",
    });
    await legacy.open();
    await legacy.table("recipes").add({
      id: "legacy-preset",
      name: "旧分类配方",
      kind: "preset",
      method: "热冲",
      coffeeGrams: 15,
      brewWaterGrams: 240,
      iceGrams: 0,
      grind: "中细",
      temperatureC: 90,
      durationSeconds: 150,
      pour: "三段注水",
      steps: [],
      createdAt: 1,
      updatedAt: 1,
      source: { type: "preset-copy" },
    });
    legacy.close();

    await db.open();
    const migrated = await db.recipes.get("legacy-preset");

    expect(migrated).toBeDefined();
    expect("kind" in migrated!).toBe(false);
    expect(migrated?.source?.type).toBe("manual");
  });

  it("clears the best cup when its journal is deleted", async () => {
    await seedDatabase();
    const journal = await db.journals.get("j1");

    await deleteJournal(journal!);

    expect((await db.beans.get("yr"))?.bestJournalId).toBeUndefined();
    expect(await db.journals.get("j1")).toBeUndefined();
  });

  it("deletes a bean with its journals and suggestions", async () => {
    await seedDatabase();
    const recipe = await db.recipes.get("mine");
    await db.aiSuggestions.add({
      id: "yr:热冲",
      beanId: "yr",
      method: "热冲",
      content: recipe!,
      why: "测试",
      source: "local",
      generatedAt: Date.now(),
      beanFingerprint: "test",
    });

    await deleteBean("yr");

    expect(await db.beans.get("yr")).toBeUndefined();
    expect(await db.journals.where("beanId").equals("yr").count()).toBe(0);
    expect(await db.aiSuggestions.where("beanId").equals("yr").count()).toBe(0);
    expect(await db.recipes.get("mine")).toBeDefined();
  });
});
