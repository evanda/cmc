import { createCmcClient } from '@cmc/shared';

/**
 * Offline demo mode: fake auth + in-memory data, no backend. Used to render the
 * app for screenshots (incl. async dev review). Gated by env so it's dead-code
 * eliminated from normal builds. `1`/`sample` = sample campus; `midway` = the
 * real Midway PCA dataset. See lib/datasource.ts.
 */
export const isDemo = ['1', 'sample', 'midway'].includes(import.meta.env.VITE_DEMO ?? '');

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when env is wired up — lets the UI show a friendly setup hint instead of crashing. */
export const isSupabaseConfigured = Boolean(url && key);

// Construct lazily-safe: if unconfigured we still export a client built from
// empty strings would throw, so guard and surface a clear message in the UI.
export const supabase = isSupabaseConfigured
  ? createCmcClient({ url, key })
  : (null as unknown as ReturnType<typeof createCmcClient>);
