import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: { 'process.env.NODE_ENV': '"production"' },
});
