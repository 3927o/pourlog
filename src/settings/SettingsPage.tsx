import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { callAI } from "../ai";
import {
  DEFAULT_AI_SETTINGS,
  textAISettings,
  visionAISettings,
  withAISettingsDefaults,
} from "../aiConfig";
import { db } from "../db";
import type { AppSettings } from "../models";
import { Back, Field, Loading, NotFound, Page } from "../ui";

function cleanSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    apiBase: settings.apiBase.trim().replace(/\/+$/, ""),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || DEFAULT_AI_SETTINGS.model,
    visionApiBase: settings.visionApiBase.trim().replace(/\/+$/, ""),
    visionApiKey: settings.visionApiKey.trim(),
    visionModel: settings.visionModel.trim() || DEFAULT_AI_SETTINGS.visionModel,
  };
}

function visionTestImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成测试图片");
  context.fillStyle = "#f6f8f3";
  context.fillRect(0, 0, 96, 96);
  context.fillStyle = "#3f6b45";
  context.fillRect(20, 20, 56, 56);
  context.fillStyle = "#ffffff";
  context.font = "bold 20px sans-serif";
  context.fillText("BEAN", 22, 56);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get("main"), [], null);
  const navigate = useNavigate();
  const [form, setForm] = useState<AppSettings>(() => ({
    ...DEFAULT_AI_SETTINGS,
  }));
  const [messages, setMessages] = useState({ text: "", vision: "" });
  const [testing, setTesting] = useState<"text" | "vision">();

  useEffect(() => {
    if (settings) setForm(withAISettingsDefaults(settings));
  }, [settings]);

  if (settings === null)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (!settings) return <NotFound message="应用设置不存在" />;

  async function save(event: FormEvent) {
    event.preventDefault();
    await db.settings.put(cleanSettings(form));
    navigate("/beans");
  }

  async function test(target: "text" | "vision") {
    const cleaned = cleanSettings(form);
    const endpoint =
      target === "text" ? textAISettings(cleaned) : visionAISettings(cleaned);
    if (!endpoint.apiBase || !endpoint.apiKey) {
      setMessages((current) => ({
        ...current,
        [target]: "⚠ 请先填写 Base URL 和 API Key",
      }));
      return;
    }
    setTesting(target);
    setMessages((current) => ({ ...current, [target]: "" }));
    try {
      await callAI(
        endpoint,
        target === "text"
          ? [{ role: "user", content: '严格只回复 JSON：{"ok":true}' }]
          : [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: '确认你能读取随附图片，严格只回复 JSON：{"ok":true}',
                  },
                  {
                    type: "image_url",
                    image_url: { url: visionTestImage() },
                  },
                ],
              },
            ],
      );
      await db.settings.put(cleaned);
      setForm(cleaned);
      setMessages((current) => ({
        ...current,
        [target]: "✓ 连接成功，已保存",
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [target]: `✕ ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      setTesting(undefined);
    }
  }

  return (
    <Page nav={false}>
      <form className="content form" onSubmit={save}>
        <Back to="/beans" />
        <h1>AI 设置</h1>
        <p className="muted">// 两条独立的 OpenAI 兼容接口 · 配置仅存本机</p>

        <section className="settings-group">
          <header>
            <span>// TEXT AI</span>
            <h2>配方与复盘</h2>
          </header>
          <div
            className={`status ${form.apiBase && form.apiKey ? "ready" : ""}`}
          >
            {form.apiBase && form.apiKey
              ? `● 已配置 · ${form.model}`
              : "○ 未配置 · 使用本地规则"}
          </div>
          <Field
            label="TEXT BASE URL"
            value={form.apiBase}
            placeholder="https://api.deepseek.com"
            onChange={(value) => setForm({ ...form, apiBase: value })}
          />
          <Field
            label="TEXT API KEY"
            type="password"
            value={form.apiKey}
            placeholder="sk-..."
            onChange={(value) => setForm({ ...form, apiKey: value })}
          />
          <Field
            label="TEXT MODEL"
            value={form.model}
            placeholder={DEFAULT_AI_SETTINGS.model}
            onChange={(value) => setForm({ ...form, model: value })}
          />
          <button
            type="button"
            className="dark full"
            disabled={Boolean(testing)}
            onClick={() => test("text")}
          >
            {testing === "text" ? "↻ 连接中…" : "↻ 测试文本模型"}
          </button>
          {messages.text && (
            <p className={messages.text.startsWith("✓") ? "success" : "error"}>
              {messages.text}
            </p>
          )}
        </section>

        <section className="settings-group vision-settings">
          <header>
            <span>// VISION AI</span>
            <h2>豆袋识别 · QWEN</h2>
          </header>
          <div
            className={`status ${form.visionApiBase && form.visionApiKey ? "ready" : ""}`}
          >
            {form.visionApiBase && form.visionApiKey
              ? `● 已配置 · ${form.visionModel}`
              : "○ 未配置 · 相机识别不可用"}
          </div>
          <Field
            label="VISION BASE URL"
            value={form.visionApiBase}
            placeholder="https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
            onChange={(value) => setForm({ ...form, visionApiBase: value })}
          />
          <small className="hint">阿里云百炼业务空间的 OpenAI 兼容地址</small>
          <Field
            label="VISION API KEY"
            type="password"
            value={form.visionApiKey}
            placeholder="sk-..."
            onChange={(value) => setForm({ ...form, visionApiKey: value })}
          />
          <Field
            label="VISION MODEL"
            value={form.visionModel}
            placeholder={DEFAULT_AI_SETTINGS.visionModel}
            onChange={(value) => setForm({ ...form, visionModel: value })}
          />
          <button
            type="button"
            className="dark full"
            disabled={Boolean(testing)}
            onClick={() => test("vision")}
          >
            {testing === "vision" ? "↻ 识图测试中…" : "↻ 测试视觉模型"}
          </button>
          {messages.vision && (
            <p
              className={messages.vision.startsWith("✓") ? "success" : "error"}
            >
              {messages.vision}
            </p>
          )}
        </section>
        <p className="security-note">
          两组 API Key 会保存在当前浏览器的 IndexedDB
          中。请只在私人设备上使用，不要配置来源不可信的接口地址。
        </p>
        <button className="primary full">▸ 保存设置</button>
      </form>
    </Page>
  );
}
