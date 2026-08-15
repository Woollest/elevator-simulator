import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  base: '/elevator-simulator/',
  publicDir: '../public',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2023'
  },
  test: {
    environment: 'node',
    include: ['../src/**/*.test.ts']
  }
});
