/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_WORKSPACE_ID?: string;
  readonly VITE_APPCHECK_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_USE_FIREBASE_EMULATOR?: string;
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_PROTOTYPE_NOTICE?: string;
  /** Endereço oficial do portal, usado na URL canônica e no og:url. */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  VLibras?: { Widget: new (url: string) => unknown };
}
