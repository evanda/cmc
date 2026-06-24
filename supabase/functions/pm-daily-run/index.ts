// Edge Function: pm-daily-run
// HTTP gateway for the pm_daily_run() SQL function.  Called by pg_cron via
// net.http_post, or triggered manually by an admin ("run now" button, not yet
// built in the UI but useful for testing).  The real scheduling logic lives in
// the SQL function (0014_pm_cron.sql) so there's one source of truth.
//
// Authentication: accepts either
//   Authorization: Bearer <service-role-key>
//   x-internal-secret: <CRON_SECRET env var>
// pg_cron should send the service-role key via the Authorization header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';

  const authHeader = req.headers.get('Authorization') ?? '';
  const internalSecret = req.headers.get('x-internal-secret') ?? '';

  const authorized =
    (cronSecret && internalSecret === cronSecret) ||
    authHeader === `Bearer ${serviceRoleKey}`;

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await db.rpc('pm_daily_run');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
