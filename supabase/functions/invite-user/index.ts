// Edge Function: invite-user
// Sends a Supabase auth invite email and sets the invited user's role.
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

    const { email, role } = await req.json();
    if (!email || typeof email !== 'string') return json({ error: 'email is required' }, 400);

    // SITE_URL is set as a function secret in production (supabase secrets set SITE_URL=…).
    // Falls back to local dev default so invite links work without extra config.
    const siteUrl = (Deno.env.get('SITE_URL') ?? 'http://127.0.0.1:5173').replace(/\/$/, '');

    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/accept-invite`,
      });
    if (inviteErr) return json({ error: inviteErr.message }, 400);

    // The on_auth_user_created trigger created the public.users row with role 'requester'.
    // Promote to the requested role now if it differs.
    const targetRole = role ?? 'requester';
    if (targetRole !== 'requester' && invited?.user?.id) {
      await supabaseAdmin.from('users').update({ role: targetRole }).eq('id', invited.user.id);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
