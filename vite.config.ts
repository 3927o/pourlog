import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        landing: "landing.html",
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // landing.html 是独立静态页，SPA 导航回退不应劫持它
        navigateFallbackDenylist: [/^\/landing/],
      },
      manifest: {
        name: "手冲陪学 · POUR.LOG",
        short_name: "POUR.LOG",
        description: "手冲咖啡陪学：豆样本库 · 冲煮日志 · 六维口感评分",
        lang: "zh-CN",
        display: "standalone",
        theme_color: "#1c231d",
        background_color: "#edf0ea",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
    }),
  ],
});
