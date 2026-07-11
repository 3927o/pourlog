import { describe, expect, it } from "vitest";
import { localSuggestion } from "./ai";
import type { Bean } from "./models";

const bean: Bean = {
  id: "test",
  no: "01",
  name: "测试豆",
  origin: "测试产区",
  process: "水洗",
  roast: "浅烘",
  roastDate: "07.11",
  flavors: ["柑橘"],
};

describe("local recipe suggestions", () => {
  it("uses cold water and coarse grind for cold brew", () => {
    const suggestion = localSuggestion(bean, "冷萃");

    expect(suggestion.content.temperatureC).toBeNull();
    expect(suggestion.content.grind).toBe("粗研磨");
    expect(suggestion.content.durationSeconds).toBe(36000);
  });

  it("accounts for ice separately in an iced pour-over", () => {
    const suggestion = localSuggestion(bean, "冰冲");

    expect(suggestion.content.coffeeGrams).toBe(15);
    expect(suggestion.content.brewWaterGrams).toBe(160);
    expect(suggestion.content.iceGrams).toBe(65);
    expect(suggestion.content.steps.at(-1)?.targetWaterGrams).toBe(160);
  });
});
