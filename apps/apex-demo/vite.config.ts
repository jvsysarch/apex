import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/apex/' : '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
