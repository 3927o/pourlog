# POUR.LOG · 手冲陪学

手冲咖啡陪学 App。用实验记录本的方式记录豆子、冲煮参数与六维口感评分，帮你把每一杯冲得比上一杯更明白。

设计源：[Claude Design · 手冲陪学 App PRD](https://claude.ai/design/p/fc591d96-ffe5-45e5-a54d-233e5bce3a52)

## 设计系统

主题：**森林绿 · Forest Green** — 实验室 / 极客数据化风格。

- 等宽字体（JetBrains Mono）管一切数据：参数、评分、meta、标签
- 黑体（Noto Sans SC）只留给标题与人写的正文
- 全局直角、1px 描边，不用圆角
- 单一强调绿 `#3f6b45`；只有过萃/异常/删除才动用警示红 `#c15a3c`
- 色随语义变：苦≥4 或干净度≤2 时数据条转红——颜色即诊断

## 文件

| 文件 | 说明 |
| --- | --- |
| [index.html](index.html) | 设计系统参考页（色彩 / 字体 / 组件 / 原则），直接用浏览器打开 |
| [tokens.css](tokens.css) | 设计 token 的 CSS 变量实现，供后续页面复用 |
| [design-tokens.json](design-tokens.json) | 机器可读的设计 token 源文件 |
