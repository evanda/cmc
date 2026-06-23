import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.js';

export type CmcClient = SupabaseClient<Database>;

export interface SupabaseConfig {
  url: string;
  /** Anon (public) key for browser clients, or service-role for server tooling. */
  key: string;
}

/**
 * Factory for a typed Supabase client. Each deployment is single-tenant
 * (plan §7.6) — the url/key come from that church's own project via env.
 */
export function createCmcClient(config: SupabaseConfig): CmcClient {
  if (!config.url || !config.key) {
    throw new Error(
      'Supabase config missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).',
    );
  }
  return createClient<Database>(config.url, config.key);
}
