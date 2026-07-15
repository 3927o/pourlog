# POUR.LOG · 手冲陪学

本地优先的手冲咖啡陪学 PWA。记录豆子、配方、冲煮日记与六维口感，让 AI 或本地规则遵循“单变量原则”给出下一杯建议，并用萃取模拟器预演调整后的效果。

## 功能

- 豆样本库：豆子档案、风味标签、历史记录与最佳配方
- 豆袋相机识别：拍摄或选择包装标签，用支持图片输入的 AI 模型预填豆子资料
- 配方库：预置/自建配方、基础参数和分步注水
- 冲煮工作流：从豆子出发选配方、跟着步骤冲煮、结束后直接记日记
- 冲煮日记：六维口感评分（酸/甜/苦/干净/醇厚/余韵）、笔记、配方快照
- AI 推荐：根据豆子特性生成热冲、冰冲或冷萃配方
- AI 复盘：根据口感评分只调整一个关键变量
- 萃取模拟器：可交互的冲煮萃取模型，涵盖研磨、水温、粉水比、水质、闷蒸、注水段数/手法等变量，附每个变量的原理讲解
- 建议联动实验：日记里的复盘建议可一键送入模拟器做单变量 A/B 实验，预测对六维口感的影响（目前支持热冲配方）
- 本地降级：未配置 AI 或接口不可用时仍可使用确定性规则
- 本地数据：Dexie + IndexedDB，不需要账号或云端数据库

## 技术栈

React 19、TypeScript、Vite、React Router、Dexie、Zod、vite-plugin-pwa，以及 CSS Design Tokens（见 `docs/design/`）。

文本 AI 与视觉 AI 分别使用 OpenAI-compatible `/chat/completions` 接口，可在设置页独立配置、测试和保存。

## 默认 AI 配置

复制 `.env.example` 为 `.env.local` 并填写默认 API Key：

```bash
VITE_AI_API_BASE=https://api.deepseek.com
VITE_AI_API_KEY=your-api-key
VITE_AI_MODEL=deepseek-v4-pro
VITE_VISION_API_BASE=https://your-workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
VITE_VISION_API_KEY=your-bailian-api-key
VITE_VISION_MODEL=qwen3.7-plus
```

`.env.local` 已被 Git 忽略。部署时请在托管平台设置同名环境变量。由于这些是 Vite 前端环境变量，它们不会出现在源码仓库中，但仍会进入浏览器构建产物；要对最终用户隐藏密钥，仍需改用服务端代理。

## 开发

```bash
npm install
npm run dev          # 本地开发
npm run build        # 类型检查 + 构建
npm run test         # Vitest 单测（含模拟器引擎与实验逻辑）
npm run format       # Prettier 格式化
```
