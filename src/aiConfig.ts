import type { AppSettings } from "./models";

export const DEFAULT_AI_SETTINGS: AppSettings = {
  id: "main",
  apiBase:
    import.meta.env.VITE_AI_API_BASE?.trim() || "https://api.deepseek.com",
  apiKey: import.meta.env.VITE_AI_API_KEY?.trim() || "",
  model: import.meta.env.VITE_AI_MODEL?.trim() || "deepseek-v4-pro",
};

export function isLegacyEmptyAISettings(settings: AppSettings) {
  return (
    !settings.apiBase &&
    !settings.apiKey &&
    (!settings.model || settings.model === "gpt-4o-mini")
  );
}
