import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New versions are installed automatically the next time the app is opened
      registerType: 'autoUpdate',
      // Icons are generated from public/logo.svg (see pwa-assets.config.ts)
      pwaAssets: {
        config: true,
      },
      manifest: {
        name: 'Earlybird Warenbestände',
        short_name: 'EB Bestand',
        description: 'Inventory report for the Earlybird Kommissionierung team',
        lang: 'de',
        theme_color: '#2f6b3a',
        background_color: '#ffffff',
        display: 'fullscreen',
        orientation: 'any',
        start_url: '/',
      },
      workbox: {
        // Cache all built files so the app opens without internet
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Page URLs fall back to index.html offline, but API calls must always reach the backend
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        // Lets you test the manifest and service worker during `npm run dev`
        enabled: true,
      },
    }),
  ],
  server: {
    // Makes the dev server reachable from a tablet on the same Wi-Fi
    host: true,
    // Forwards /api calls to the FastAPI dev server, so the frontend can use relative URLs.
    // 127.0.0.1 rather than localhost: Node resolves localhost to IPv6, FastAPI listens on IPv4
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
