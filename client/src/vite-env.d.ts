interface ImportMetaEnv {
  readonly MODE: string;
  readonly VITE_SENTRY_DSN: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
