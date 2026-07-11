import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, nextBeanNumber, seedDatabase } from "./db";

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

  it("marks an existing database without adding demo records", async () => {
    await db.settings.add({
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

  it("allocates a number above the highest existing bean number", async () => {
    await seedDatabase();
    await db.beans.delete("hl");

    expect(await nextBeanNumber()).toBe("04");
  });
});
