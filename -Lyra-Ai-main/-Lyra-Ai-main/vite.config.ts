import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
        proxy: {
          '/kie-upload': {
            target: 'https://kieai.redpandaai.co',
            changeOrigin: true,
            secure: false,
            rewrite: (path: string) => path.replace(/^\/kie-upload/, ''),
          },
          '/kie-api': {
            target: 'https://api.kie.ai',
            changeOrigin: true,
            secure: false,
            rewrite: (path: string) => path.replace(/^\/kie-api/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
