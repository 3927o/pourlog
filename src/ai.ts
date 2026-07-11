import { z } from "zod";
import type {
  AppSettings,
  Bean,
  BrewDimensions,
  BrewMethod,
  Recipe,
} from "./models";

const stepSchema = z.object({
  t: z.string(),
  water: z.string(),
  note: z.string().default(""),
});
const analysisSchema = z.object({
  variable: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string(),
  principle: z.string(),
  advanced: z.array(z.string()).default([]),
});
const suggestionSchema = z.object({
  ratio: z.string(),
  grind: z.string(),
  temp: z.string(),
  time: z.string(),
  steps: z.array(stepSchema),
  why: z.string(),
});

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
  recipe: Recipe,
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
      content: `豆：${bean.name}（${bean.origin}），${bean.process}/${bean.roast}。\n本次配方：${recipe.ratio} · ${recipe.grind} · ${recipe.temp} · ${recipe.time}。\n六维口感（1-5）：酸${dims.acid} 甜${dims.sweet} 苦${dims.bitter} 干净度${dims.clean} 余韵${dims.finish} 醇厚${dims.body}。\n备注：${notes || "无"}。\n严格只返回JSON：{"variable":"变量名","from":"当前值","to":"建议值","reason":"结合评分说明因果，60字内","principle":"单变量原则提醒","advanced":["进阶建议1","进阶建议2"]}`,
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
        "你是一位专业手冲咖啡师。根据豆子特性给出一套完整、分步可执行的手冲配方。使用简体中文。",
    },
    {
      role: "user",
      content: `为这支豆推荐一套【${method}】配方。\n豆：${bean.name}（${bean.origin}），${bean.process}/${bean.roast}，风味 ${bean.flavors.join("/")}。\n严格只返回JSON：{"ratio":"1:16","grind":"中细","temp":"90°C","time":"2:30","steps":[{"t":"0:00","water":"0→40g","note":"闷蒸"}],"why":"推荐理由，60字内"}`,
    },
  ]);
  return { ...suggestionSchema.parse(result), source: "ai" as const };
}

export function localAnalysis(recipe: Recipe, d: BrewDimensions) {
  const temp = Number.parseInt(recipe.temp) || 92;
  if (d.bitter >= 4 || d.clean <= 2)
    return {
      variable: "水温",
      from: `${temp}°C`,
      to: `${temp - 4}°C`,
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
      from: recipe.ratio,
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
  if (method === "冷萃") {
    return {
      ratio: "1:12",
      grind: "粗研磨",
      temp: "冷水 / 室温水",
      time: "8–12h",
      steps: [{ t: "0:00", water: "按 1:12 一次注满", note: "搅匀后冷藏浸泡" }],
      why: `${bean.roast}${bean.process}豆使用粗研磨冷藏浸泡，减少苦涩并保留${bean.flavors[0] || "主要风味"}。`,
      source: "local" as const,
    };
  }

  const temp =
    bean.roast === "浅烘" ? "92°C" : bean.roast === "深烘" ? "86°C" : "89°C";
  const grind =
    bean.roast === "浅烘"
      ? "中细偏细"
      : bean.roast === "深烘"
        ? "中细偏粗"
        : "中细";
  return {
    ratio: method === "冰冲" ? "1:15" : "1:16",
    grind,
    temp,
    time: method === "冰冲" ? "2:00" : "2:30",
    steps:
      method === "冰冲"
        ? [
            { t: "0:00", water: "分享壶放 80g 冰", note: "咖啡液直接落冰" },
            { t: "0:00", water: "0→36g", note: "闷蒸" },
            { t: "0:30", water: "36→100g", note: "第二段绕圈" },
            { t: "1:05", water: "100→160g", note: "收尾后摇匀" },
          ]
        : [
            { t: "0:00", water: "0→36g", note: "闷蒸" },
            { t: "0:30", water: "36→150g", note: "第二段绕圈" },
            { t: "1:10", water: "150→240g", note: "收尾" },
          ],
    why: `${bean.roast}${bean.process}豆，${temp} 配合${grind}研磨可平衡萃取，凸显${bean.flavors[0] || "主要风味"}。`,
    source: "local" as const,
  };
}
