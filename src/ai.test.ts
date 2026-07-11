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

    expect(suggestion.temp).toContain("冷水");
    expect(suggestion.grind).toBe("粗研磨");
    expect(suggestion.time).toBe("8–12h");
  });

  it("accounts for ice separately in an iced pour-over", () => {
    const suggestion = localSuggestion(bean, "冰冲");

    expect(suggestion.ratio).toBe("1:15");
    expect(suggestion.steps[0]?.water).toContain("80g 冰");
    expect(suggestion.steps.at(-1)?.water).toBe("100→160g");
  });
});
