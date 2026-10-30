import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_RAILBUS_BACKEND_URL || 'http://127.0.0.1:8008';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/passenger-app': {
          target: 'http://127.0.0.1:5174',
          changeOrigin: true,
        },
        '/railbus-api': {
          target: backend,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/railbus-api/, ''),
        },
      },
    },
  };
});
