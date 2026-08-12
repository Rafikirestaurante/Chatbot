import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        injectRegister: false,
        includeAssets: ["icons/rafiki-192.png", "icons/rafiki-512.png"],
        manifest: {
          name: "Rafiki Recordatorios",
          short_name: "Rafiki",
          description: "Chat privado para crear y recibir recordatorios.",
          theme_color: "#075e54",
          background_color: "#efeae2",
          display: "standalone",
          start_url: "/",
          scope: "/",
          orientation: "portrait-primary",
          icons: [
            {
              src: "/icons/rafiki-192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "/icons/rafiki-512.png",
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: "/icons/rafiki-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          shortcuts: [
            {
              name: "Nuevo recordatorio",
              short_name: "Nuevo",
              url: "/?focus=message",
              icons: [{ src: "/icons/rafiki-192.png", sizes: "192x192" }]
            },
            {
              name: "Mis recordatorios",
              short_name: "Pendientes",
              url: "/recordatorios",
              icons: [{ src: "/icons/rafiki-192.png", sizes: "192x192" }]
            }
          ]
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]
        },
        devOptions: {
          enabled: true,
          type: "module"
        }
      })
    ],
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      host: true
    },
    build: {
      sourcemap: false
    }
  };
});
