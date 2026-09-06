import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // /uploads/<file> is excluded too: MediaPage's/SettingsPage's
        // <a href={url} download> links are same-origin navigations from
        // the service worker's point of view, and without this it would
        // intercept them and hand back the cached app shell instead of the
        // actual file.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
      },
      manifest: {
        name: 'TeamXtreme',
        short_name: 'TeamXtreme',
        description: 'Reiseorganisation für das Team',
        lang: 'de',
        theme_color: '#7e161f',
        background_color: '#efefef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      // Profile pictures and shared media (MediaPage, SettingsPage) are
      // served back at /uploads/<file>, outside /api — proxy it too so
      // they render in frontend-only dev instead of 404ing against Vite's
      // own dev server.
      '/uploads': 'http://localhost:8000',
    },
  },
});
