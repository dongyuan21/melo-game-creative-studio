import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const base = process.env.PAGES_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    setupFiles: ['./tests/setupPlatform.ts'],
    exclude: ['**/node_modules/**', 'packages/dsh-plugin-melo/test/**'],
  },
});
