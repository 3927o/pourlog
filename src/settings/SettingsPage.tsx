import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { callAI } from "../ai";
import { DEFAULT_AI_SETTINGS } from "../aiConfig";
import { db } from "../db";
import type { AppSettings } from "../models";
import { Back, Field, Loading, NotFound, Page } from "../ui";

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get("main"), [], null);
  const navigate = useNavigate();
  const [form, setForm] = useState<AppSettings>(() => ({
    ...DEFAULT_AI_SETTINGS,
  }));
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
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
    await db.settings.put({
      ...form,
      apiBase: form.apiBase.trim().replace(/\/+$/, ""),
      apiKey: form.apiKey.trim(),
      model: form.model.trim() || DEFAULT_AI_SETTINGS.model,
    });
    navigate("/beans");
  }

  async function test() {
    if (!form.apiBase || !form.apiKey) {
      setMessage("⚠ 请先填写 Base URL 和 API Key");
      return;
    }
    setTesting(true);
    setMessage("");
    try {
      await callAI(form, [
        { role: "user", content: '严格只回复 JSON：{"ok":true}' },
      ]);
      await db.settings.put(form);
      setMessage("✓ 连接成功，已保存");
    } catch (error) {
      setMessage(`✕ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Page nav={false}>
      <form className="content form" onSubmit={save}>
        <Back to="/beans" />
        <h1>AI 设置</h1>
        <p className="muted">// OpenAI 兼容接口 · 数据仅存本地浏览器</p>
        <div className={`status ${form.apiBase && form.apiKey ? "ready" : ""}`}>
          {form.apiBase && form.apiKey
            ? `● 已配置 · ${form.model}`
            : "○ 未配置 · AI 使用本地规则"}
        </div>
        <Field
          label="BASE URL"
          value={form.apiBase}
          placeholder="https://api.openai.com/v1"
          onChange={(value) => setForm({ ...form, apiBase: value })}
        />
        <small className="hint">末尾含 /v1，自动补 /chat/completions</small>
        <Field
          label="API KEY"
          type="password"
          value={form.apiKey}
          placeholder="sk-..."
          onChange={(value) => setForm({ ...form, apiKey: value })}
        />
        <Field
          label="MODEL"
          value={form.model}
          placeholder={DEFAULT_AI_SETTINGS.model}
          onChange={(value) => setForm({ ...form, model: value })}
        />
        <button
          type="button"
          className="dark full"
          disabled={testing}
          onClick={test}
        >
          {testing ? "↻ 连接中…" : "↻ 测试连接"}
        </button>
        {message && (
          <p className={message.startsWith("✓") ? "success" : "error"}>
            {message}
          </p>
        )}
        <p className="security-note">
          API Key 会保存在当前浏览器的 IndexedDB
          中。请只在私人设备上使用，不要配置来源不可信的接口地址。
        </p>
        <button className="primary full">▸ 保存设置</button>
      </form>
    </Page>
  );
}
