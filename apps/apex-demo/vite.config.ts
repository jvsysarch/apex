import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/apex/' : '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
