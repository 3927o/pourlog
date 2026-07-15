import type { AIEndpointSettings, AppSettings } from "./models";

export const DEFAULT_AI_SETTINGS: AppSettings = {
  id: "main",
  apiBase:
    import.meta.env.VITE_AI_API_BASE?.trim() || "https://api.deepseek.com",
  apiKey: import.meta.env.VITE_AI_API_KEY?.trim() || "",
  model: import.meta.env.VITE_AI_MODEL?.trim() || "deepseek-v4-pro",
  visionApiBase: import.meta.env.VITE_VISION_API_BASE?.trim() || "",
  visionApiKey: import.meta.env.VITE_VISION_API_KEY?.trim() || "",
  visionModel: import.meta.env.VITE_VISION_MODEL?.trim() || "qwen3.7-plus",
};

export function withAISettingsDefaults(
  settings: Partial<AppSettings>,
): AppSettings {
  return {
    ...DEFAULT_AI_SETTINGS,
    ...settings,
    id: "main",
    visionApiBase: settings.visionApiBase ?? DEFAULT_AI_SETTINGS.visionApiBase,
    visionApiKey: settings.visionApiKey ?? DEFAULT_AI_SETTINGS.visionApiKey,
    visionModel: settings.visionModel || DEFAULT_AI_SETTINGS.visionModel,
  };
}

export function textAISettings(settings: AppSettings): AIEndpointSettings {
  return {
    apiBase: settings.apiBase,
    apiKey: settings.apiKey,
    model: settings.model,
  };
}

export function visionAISettings(settings: AppSettings): AIEndpointSettings {
  return {
    apiBase: settings.visionApiBase,
    apiKey: settings.visionApiKey,
    model: settings.visionModel,
  };
}

export function isLegacyEmptyAISettings(settings: Partial<AppSettings>) {
  return (
    !settings.apiBase &&
    !settings.apiKey &&
    (!settings.model || settings.model === "gpt-4o-mini")
  );
}
