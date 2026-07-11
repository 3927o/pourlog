# POUR.LOG · 手冲陪学

本地优先的手冲咖啡陪学 PWA。记录豆子、配方、冲煮日记与六维口感，让 AI 或本地规则遵循“单变量原则”给出下一杯建议。

## 功能

- 豆样本库：豆子档案、风味标签、历史记录与最佳配方
- 配方库：预置/自建配方、基础参数和分步注水
- 冲煮日记：六维口感评分、笔记、配方快照
- AI 推荐：根据豆子特性生成热冲、冰冲或冷萃配方
- AI 复盘：根据口感评分只调整一个关键变量
- 本地降级：未配置 AI 或接口不可用时仍可使用确定性规则
- 本地数据：Dexie + IndexedDB，不需要账号或云端数据库

## 技术栈

React 19、TypeScript、Vite、React Router、Dexie、Zod、vite-plugin-pwa，以及 CSS Design Tokens。

AI 使用 OpenAI-compatible `/chat/completions` 接口。用户可在设置页配置 Base URL、API Key 和 Model。

## 开发

```bash
npm install
npm run dev
npm run build
```
