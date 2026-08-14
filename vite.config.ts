/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      // NOTE: The URL pattern below must match VITE_SUPABASE_URL from your .env
      manifest: false, // We use our own manifest.json
      // Service Worker AUTODESTRUCTIVO: el PWA (precaché offline) causó dos caídas
      // en blanco: tras un deploy, el SW viejo servía un shell que pedía chunks JS
      // ya renombrados -> 404 -> pantalla en blanco, y el SW viejo no se
      // actualizaba a tiempo. Con selfDestroying, el build emite un sw.js cuya
      // única tarea es DESREGISTRARSE y BORRAR todas las precachés en el próximo
      // load de cada dispositivo. Así todos los usuarios con el SW viejo quedan
      // limpios automáticamente (sin tocar DevTools) y la app se sirve directo de
      // la red. Esta app es un panel con datos en vivo de Supabase; el caché
      // offline aportaba poco y costó dos incidentes.
      selfDestroying: true,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        // El SW nuevo toma control de inmediato y limpia las precachés viejas.
        // Sin esto, tras un deploy el SW viejo puede servir un shell que apunta a
        // archivos JS que ya no existen -> pantalla en blanco.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/juiskeeutbaipwbeeezw\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Sólo separamos las librerías del "shell" (que la app siempre necesita)
        // en chunks propios cacheables entre deploys. Todo lo demás —incluidas las
        // pesadas (pdf/excel/gráficos/calendario)— NO se agrupa aquí a propósito:
        // así Rollup las co-ubica con la página lazy que las usa y sólo se
        // descargan al visitar esa ruta (nada de un mega-chunk "vendor" eager).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "react-router";
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack")) return "tanstack";
          return undefined;
        },
      },
    },
  },
}));
