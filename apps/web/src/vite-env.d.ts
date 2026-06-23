/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** '1' enables offline demo mode (fake auth + in-memory data) for screenshots. */
  readonly VITE_DEMO: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
