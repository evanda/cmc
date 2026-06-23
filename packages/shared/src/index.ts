// @cmc/shared — types, validation schemas, the typed Supabase client, and the
// PM engine, shared across apps/web, apps/mobile, apps/loader (plan §7.1).

export * from './types/enums.js';
export * from './types/domain.js';
export type { Database } from './types/database.js';

export * from './schemas/forms.js';

export { createCmcClient } from './supabase/client.js';
export type { CmcClient, SupabaseConfig } from './supabase/client.js';

export * from './pm/next-due.js';
