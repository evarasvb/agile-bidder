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
    // NOTA: NO usar manualChunks para separar react/react-dom de las librerías
    // que dependen de él (radix, react-router, tanstack, etc.). Separarlos en
    // chunks propios rompe el ORDEN DE INICIALIZACIÓN de los módulos ES: un chunk
    // (p.ej. Radix, que llama a React.forwardRef en su nivel superior) se evalúa
    // cuando el binding de React todavía es undefined ->
    //   "TypeError: Cannot read properties of undefined (reading 'forwardRef')"
    // -> la app NUNCA monta -> pantalla en blanco para TODOS. Causó una caída de
    // producción. El code-splitting real ya lo da el lazy-loading por ruta
    // (React.lazy en App.tsx); dejamos que Vite/Rollup arme los vendor chunks con
    // su default, que respeta el orden de init.
  },
}));
