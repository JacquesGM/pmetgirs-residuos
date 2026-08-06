import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base só se aplica ao build de produção: a página é publicada em
// jacquesgm.github.io/pmetgirs-residuos/ (site de projeto do GitHub Pages,
// não a raiz do domínio), mas o servidor de desenvolvimento continua em "/".
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/pmetgirs-residuos/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}));
