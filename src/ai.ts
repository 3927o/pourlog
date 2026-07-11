import { z } from "zod";
import type {
  AppSettings,
  Bean,
  BrewDimensions,
  BrewMethod,
  RecipeContent,
} from "./models";
import { formatRatio, formatTemperature, formatDuration } from "./models";

const stepSchema = z.object({
  atSeconds: z.number().nonnegative(),
  targetWaterGrams: z.number().nonnegative(),
  note: z.string().default(""),
});
const contentSchema = z.object({
  coffeeGrams: z.number().positive(),
  brewWaterGrams: z.number().positive(),
  iceGrams: z.number().nonnegative(),
  grind: z.string().min(1),
  temperatureC: z.number().nullable(),
  durationSeconds: z.number().positive(),
  pour: z.string().default(""),
  steps: z.array(stepSchema),
});
const analysisSchema = z.object({
  variable: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string(),
  principle: z.string(),
  advanced: z.array(z.string()).default([]),
});
const suggestionSchema = z.object({ content: contentSchema, why: z.string() });

function extractJson(content: string): unknown {
  const match = content.trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error("模型没有返回有效 JSON");
  return JSON.parse(match[0]);
}

export async function callAI(
  settings: AppSettings,
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  const base = settings.apiBase.replace(/\/+$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4o-mini",
      temperature: 0.5,
      messages,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 160);
    throw new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ""}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return extractJson(data.choices?.[0]?.message?.content ?? "");
}

export async function analyzeCup(
  settings: AppSettings,
  bean: Bean,
  recipe: RecipeContent,
  dims: BrewDimensions,
  notes: string,
) {
  const result = await callAI(settings, [
    {
      role: "system",
      content:
        "你是一位专业手冲咖啡师和萃取教练。基于用户记录的六维口感，遵循“单变量原则”，只建议调整一个最关键的变量。使用简体中文，务实、克制。",
    },
    {
      role: "user",
      content: `豆：${bean.name}（${bean.origin}），${bean.process}/${bean.roast}。\n本次配方：1:${formatRatio(recipe)} · ${recipe.grind} · ${formatTemperature(recipe.temperatureC)} · ${formatDuration(recipe.durationSeconds)}。\n六维口感（1-5）：酸${dims.acid} 甜${dims.sweet} 苦${dims.bitter} 干净度${dims.clean} 余韵${dims.finish} 醇厚${dims.body}。\n备注：${notes || "无"}。\n严格只返回JSON：{"variable":"变量名","from":"当前值","to":"建议值","reason":"结合评分说明因果，60字内","principle":"单变量原则提醒","advanced":["进阶建议1","进阶建议2"]}`,
    },
  ]);
  return { ...analysisSchema.parse(result), source: "ai" as const };
}

export async function suggestRecipe(
  settings: AppSettings,
  bean: Bean,
  method: BrewMethod,
) {
  const result = await callAI(settings, [
    {
      role: "system",
      content:
        "你是一位专业手冲咖啡师。根据豆子特性给出一套结构化、分步可执行的配方。克重和秒数必须是有效数字，步骤水量使用累计冲煮水且不包含冰。使用简体中文。",
    },
    {
      role: "user",
      content: `为这支豆推荐一套【${method}】配方。\n豆：${bean.name}（${bean.origin}），${bean.process}/${bean.roast}，风味 ${bean.flavors.join("/")}。\n严格只返回JSON：{"content":{"coffeeGrams":15,"brewWaterGrams":240,"iceGrams":0,"grind":"中细","temperatureC":90,"durationSeconds":150,"pour":"三段注水","steps":[{"atSeconds":0,"targetWaterGrams":40,"note":"闷蒸"}]},"why":"推荐理由，60字内"}`,
    },
  ]);
  const parsed = suggestionSchema.parse(result);
  return {
    ...parsed,
    content: { method, ...parsed.content },
    source: "ai" as const,
  };
}

export function localAnalysis(recipe: RecipeContent, d: BrewDimensions) {
  const temperature = recipe.temperatureC ?? 20;
  if (d.bitter >= 4 || d.clean <= 2)
    return {
      variable: "水温",
      from: formatTemperature(recipe.temperatureC),
      to: `${temperature - 4}°C`,
      reason: `苦味 ${d.bitter}、干净度 ${d.clean}，降低水温可减少过度萃取带来的苦味与杂味。`,
      principle: "一次只动这一个变量，才能确认因果。",
      advanced: ["研磨可略粗半格", "第三段注水提早 5 秒收尾"],
      source: "local" as const,
    };
  if (d.acid >= 4)
    return {
      variable: "研磨",
      from: recipe.grind,
      to: `${recipe.grind}（略细）`,
      reason: `酸度 ${d.acid} 偏尖，略细研磨提高萃取，有助于拉出甜感。`,
      principle: "先只动研磨，水温与粉水比保持不变。",
      advanced: ["闷蒸延长 5 秒", "稳定注水速度"],
      source: "local" as const,
    };
  if (d.sweet <= 2)
    return {
      variable: "粉水比",
      from: `1:${formatRatio(recipe)}`,
      to: "1:15",
      reason: `甜感 ${d.sweet} 偏低，提高浓度通常能带出更明显的甜感。`,
      principle: "只改粉水比，其余参数不动。",
      advanced: ["放缓注水节奏", "水温微升 1°C"],
      source: "local" as const,
    };
  return {
    variable: "保持不变",
    from: "当前配方",
    to: "再冲一杯确认",
    reason: "六维表现比较均衡，建议按原配方复现，确认稳定性后再微调。",
    principle: "稳定复现是进阶的前提。",
    advanced: ["记录豆龄与室温", "固定注水手法"],
    source: "local" as const,
  };
}

export function localSuggestion(bean: Bean, method: BrewMethod) {
  if (method === "冷萃")
    return {
      content: {
        method,
        coffeeGrams: 50,
        brewWaterGrams: 600,
        iceGrams: 0,
        grind: "粗研磨",
        temperatureC: null,
        durationSeconds: 36000,
        pour: "浸泡",
        steps: [
          { atSeconds: 0, targetWaterGrams: 600, note: "搅匀后冷藏浸泡" },
        ],
      },
      why: `${bean.roast}${bean.process}豆使用粗研磨冷藏浸泡，减少苦涩并保留${bean.flavors[0] || "主要风味"}。`,
      source: "local" as const,
    };
  const temperatureC =
    bean.roast === "浅烘" ? 92 : bean.roast === "深烘" ? 86 : 89;
  const grind =
    bean.roast === "浅烘"
      ? "中细偏细"
      : bean.roast === "深烘"
        ? "中细偏粗"
        : "中细";
  const iced = method === "冰冲";
  return {
    content: {
      method,
      coffeeGrams: 15,
      brewWaterGrams: iced ? 160 : 240,
      iceGrams: iced ? 65 : 0,
      grind,
      temperatureC,
      durationSeconds: iced ? 120 : 150,
      pour: "三段注水",
      steps: iced
        ? [
            {
              atSeconds: 0,
              targetWaterGrams: 36,
              note: "闷蒸，分享壶放 65g 冰",
            },
            { atSeconds: 30, targetWaterGrams: 100, note: "第二段绕圈" },
            { atSeconds: 65, targetWaterGrams: 160, note: "收尾后摇匀" },
          ]
        : [
            { atSeconds: 0, targetWaterGrams: 36, note: "闷蒸" },
            { atSeconds: 30, targetWaterGrams: 150, note: "第二段绕圈" },
            { atSeconds: 70, targetWaterGrams: 240, note: "收尾" },
          ],
    },
    why: `${bean.roast}${bean.process}豆，${temperatureC}°C 配合${grind}研磨可平衡萃取，凸显${bean.flavors[0] || "主要风味"}。`,
    source: "local" as const,
  };
}
