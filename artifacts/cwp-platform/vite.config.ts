import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { loadEnvFile, findEnvFile } from "../../lib/env/load-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Preserve PORT from the parent process (e.g. scripts/dev.mjs sets 21456 for Vite).
const portFromParent = process.env.PORT;
loadEnvFile(findEnvFile(repoRoot));
if (portFromParent) {
  process.env.PORT = portFromParent;
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  envDir: repoRoot,
  envPrefix: ["VITE_", "GOOGLE_"],
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "offline.html",
        "pwa/apple-touch-icon.png",
        "pwa/icon-192.png",
        "pwa/icon-512.png",
        "pwa/maskable-icon-512.png",
        "manifest-customer.json",
        "manifest-staff.json",
        "manifest-admin.json",
        "manifest-franchisee.json",
      ],
      manifest: {
        name: "CWP Detailers + Kleansolar",
        short_name: "CWP",
        description:
          "Premium car wash, detailing, and solar cleaning services across India",
        start_url: "/",
        scope: "/",
        id: "/",
        display: "standalone",
        display_override: ["standalone", "browser"],
        orientation: "any",
        background_color: "#f5f6f8",
        theme_color: "#00cccc",
        categories: ["lifestyle", "business"],
        icons: [
          {
            src: "pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa/maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json}"],
        // Main bundle exceeds Workbox default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        navigateFallback: "/index.html",
      },
    }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    ...(process.env.REPL_ID === undefined
      ? {
          proxy: {
            "/api": {
              target: "http://127.0.0.1:8080",
              changeOrigin: true,
              cookieDomainRewrite: "",
            },
          },
        }
      : {}),
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
