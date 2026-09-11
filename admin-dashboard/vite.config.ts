import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const hostedBackend = process.env.VITE_API_PROXY_TARGET || 'https://resqnet-backend-2gof.onrender.com';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: hostedBackend,
        changeOrigin: true,
        secure: true,
      },
      '/health': {
        target: hostedBackend,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
