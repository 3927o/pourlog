import { afterEach, describe, expect, it, vi } from "vitest";
import { localSuggestion, recognizeBeanLabel } from "./ai";
import type { AIEndpointSettings, Bean } from "./models";

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

const settings: AIEndpointSettings = {
  apiBase: "https://example.com/v1",
  apiKey: "test-key",
  model: "vision-model",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("bean label recognition", () => {
  it("sends an image message and normalizes the structured result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: "  花蝴蝶  ",
                  origin: " 哥伦比亚 · 慧兰 ",
                  process: "水洗",
                  roast: "浅烘",
                  roastDate: "07.15",
                  flavors: ["柑橘", " 柑橘 ", "白花"],
                  confidence: 0.88,
                  uncertainFields: ["roastDate"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await recognizeBeanLabel(
      settings,
      "data:image/jpeg;base64,abc",
    );

    expect(result.name).toBe("花蝴蝶");
    expect(result.flavors).toEqual(["柑橘", "白花"]);
    expect(result.uncertainFields).toEqual(["roastDate"]);
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(request.messages[1].content[1]).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,abc",
      },
    });
  });

  it("rejects an invalid model result with a useful error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"name":"豆子"}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      recognizeBeanLabel(settings, "data:image/jpeg;base64,abc"),
    ).rejects.toThrow("豆子信息格式不完整");
  });
});
