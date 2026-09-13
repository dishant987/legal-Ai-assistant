import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const sharedDir = fileURLToPath(new URL('../server/src/shared', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      /**
       * Client and server import the SAME schema and error-code files, so the
       * API contract cannot drift between them (R1.4). Only `server/src/shared`
       * is exposed — server config, models and services stay out of reach.
       */
      '@shared': sharedDir,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Vite refuses to serve files outside the project root unless told to.
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
