import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const config = defineConfig({
  base: './',
  define: { 'process.env.NODE_ENV': '"production"' },
  optimizeDeps: {
    include: ['react/jsx-runtime'],
  },
  plugins: [react()],
});

export default config;
