import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_RAILBUS_BACKEND_URL || 'http://127.0.0.1:8008';
  return {
    base: '/passenger-app/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'RailBus - Mysuru Feeder Transit', short_name: 'RailBus',
          description: 'Demand-triggered KSRTC feeder bus booking from Mysuru Railway Station.',
          theme_color: '#0B1F33', background_color: '#F3F6FA', display: 'standalone',
          start_url: '/passenger-app/', scope: '/passenger-app/', orientation: 'portrait-primary',
          icons: [
            { src: '/passenger-app/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/passenger-app/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/passenger-app/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/passenger-app/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Authenticated data and payment calls are network-only. Confirmed
          // tickets use the explicit IndexedDB cache in the passenger service.
          runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith('/railbus-api/'), handler: 'NetworkOnly' }],
        },
      }),
    ],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy: {
        '/railbus-api': {
          target: backend, changeOrigin: true, secure: true,
          rewrite: (path) => path.replace(/^\/railbus-api/, ''),
        },
      },
    },
  };
});
