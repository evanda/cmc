// Edge Function: delete-user
// Deletes a user from auth.users (cascades to public.users).
// Callable only by authenticated admins; uses the service-role key server-side.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify caller's JWT and check admin role.
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: appUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (appUser?.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    const { userId } = await req.json();
    if (!userId || typeof userId !== 'string') return json({ error: 'userId is required' }, 400);

    // Prevent self-deletion.
    if (userId === user.id) return json({ error: 'Cannot delete your own account' }, 400);

    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) return json({ error: deleteErr.message }, 400);

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
