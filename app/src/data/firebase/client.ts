import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';

/**
 * Inicialização do Firebase.
 *
 * Este módulo é carregado sob demanda, apenas pelas rotas de /app. O portal
 * público nunca o importa, para que o cidadão não baixe o SDK do Firebase para
 * ler uma página estática.
 *
 * Sobre segredos: a configuração web abaixo é pública por natureza — ela vai
 * embutida no bundle. Ela não autoriza nada. Quem autoriza são as Security
 * Rules, avaliadas no servidor. Credencial de Admin SDK, chave privada e senha
 * nunca aparecem aqui nem em qualquer arquivo do repositório.
 */

interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readConfig(): FirebaseEnv {
  const env = import.meta.env;
  const config: FirebaseEnv = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
  };

  const faltando = (Object.keys(config) as Array<keyof FirebaseEnv>).filter((key) => !config[key]);
  if (faltando.length > 0) {
    throw new Error(
      `Configuração do Firebase incompleta. Preencha no .env.local: ${faltando
        .map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
        .join(', ')}. Veja .env.example e o guia interno de provisionamento do Firebase.`,
    );
  }

  return config;
}

export function useEmulator(): boolean {
  return import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
}

export function workspaceId(): string {
  return import.meta.env.VITE_WORKSPACE_ID ?? 'pmetgirs-rmrj';
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function getApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(readConfig());
  return app;
}

/**
 * App Check reduz o uso dos recursos do projeto por clientes que não são a
 * nossa aplicação. Ele não substitui as Rules — soma-se a elas.
 *
 * O token de depuração serve apenas para a máquina do desenvolvedor e para o
 * CI. Publicar um token de debug equivale a abrir uma exceção permanente, por
 * isso ele só é lido fora de produção.
 */
export function initAppCheck(): void {
  const siteKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_SITE_KEY;
  if (!siteKey || useEmulator()) return;

  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  }

  initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export function getAuthClient(): Auth {
  if (authInstance) return authInstance;

  const instance = getAuth(getApp());
  if (useEmulator()) {
    connectAuthEmulator(instance, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  // A sessão sobrevive ao recarregamento da aba, mas o Firestore mantém cache
  // apenas em memória (ver abaixo): nada de conteúdo interno fica gravado no
  // disco do navegador.
  void setPersistence(instance, browserLocalPersistence);

  authInstance = instance;
  return instance;
}

export function getDb(): Firestore {
  if (dbInstance) return dbInstance;

  // Cache em memória por decisão de segurança (ADR-009): em dispositivo
  // compartilhado, a persistência em IndexedDB deixaria dados internos no
  // navegador depois do logout.
  const instance = initializeFirestore(getApp(), { localCache: memoryLocalCache() });
  if (useEmulator()) {
    connectFirestoreEmulator(instance, '127.0.0.1', 8080);
  }

  dbInstance = instance;
  return instance;
}

/** Somente para testes: descarta as instâncias memorizadas. */
export function resetFirebaseClientForTests(): void {
  app = null;
  authInstance = null;
  dbInstance = null;
}
