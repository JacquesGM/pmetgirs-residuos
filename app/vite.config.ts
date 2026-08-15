import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// O `base` depende de onde o build será publicado:
//  - Firebase Hosting (OFICIAL desde 15/08/2026): raiz do domínio;
//  - GitHub Pages (legado): site de projeto em /pmetgirs-residuos/.
// O padrão é o oficial. Publicar no legado exige pedir explicitamente
// `DEPLOY_TARGET=github-pages`, para que o destino errado nunca seja o
// resultado de esquecer uma variável. O servidor de desenvolvimento é sempre "/".
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEPLOY_TARGET ?? 'firebase';
  const base = command === 'build' && target === 'github-pages' ? '/pmetgirs-residuos/' : '/';

  return {
    base,
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // Recharts e Firebase saem do pacote principal: nenhum dos dois é
          // necessário na primeira dobra do portal público.
          //
          // O React precisa vir ANTES dos dois. Ele é dependência compartilhada
          // entre a entrada e os gráficos; sem uma casa própria, o Rollup o
          // absorve para dentro do chunk do recharts, e então a entrada passa a
          // importar React de lá — o que torna 525 kB de biblioteca de gráficos
          // obrigatórios em toda visita, justamente o que este bloco pretendia
          // evitar. Verificação: `dist/index.html` não pode ter modulepreload
          // de recharts nem de firebase.
          manualChunks(id: string) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'recharts';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase';
            }
            return undefined;
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      // Os testes das Security Rules exigem o Emulator e rodam em ambiente
      // Node, por `npm run test:rules`.
      exclude: ['node_modules/**', 'dist/**', 'firebase/**'],
    },
  };
});
