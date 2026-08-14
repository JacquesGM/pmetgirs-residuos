import { defineConfig } from 'vitest/config';

// Configuração exclusiva dos testes das Security Rules.
// Rodam em Node, contra o Emulator do Firestore, por `npm run test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['firebase/tests/**/*.test.ts'],
    // As Rules avaliam um commit por vez; execução paralela embaralharia o
    // estado compartilhado do emulador entre os arquivos.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
