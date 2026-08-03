/// <reference types="vite/client" />

interface Window {
  VLibras?: {
    Widget: new (appUrl: string) => unknown;
  };
}
