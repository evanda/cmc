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
      .select('role, name, email')
      .eq('id', user.id)
      .single();
    if (appUser?.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    const { email, role } = await req.json();
    if (!email || typeof email !== 'string') return json({ error: 'email is required' }, 400);
    const targetRole = role ?? 'requester';

    // SITE_URL is set as a function secret in production (supabase secrets set SITE_URL=…).
    // Falls back to local dev default so invite links work without extra config.
    const siteUrl = (Deno.env.get('SITE_URL') ?? 'http://127.0.0.1:5173').replace(/\/$/, '');

    // Invite-email context (issue #56). The branded template
    // (supabase/templates/invite.html) renders the app, facility, inviter, and
    // role from this metadata, so the invite isn't a bare "you've been invited".
    // Facility identity is read from org_settings — never hardcoded (plan §7.6).
    const { data: org } = await supabaseAdmin
      .from('org_settings')
      .select('facility_name, logo_url')
      .single();

    // Mirror of buildInviteMetadata() in @cmc/shared (packages/shared/src/auth/
    // invite.ts) — that file is the tested source of truth; keep this in sync.
    // (Edge functions deploy standalone and can't import the workspace package.)
    const ROLE_LABELS: Record<string, string> = {
      admin: 'Administrator',
      technician: 'Technician',
      requester: 'Requester',
      trustee: 'Trustee',
      vendor: 'Vendor',
    };
    const inviteData: Record<string, string> = {
      app_name: 'CMC',
      app_full_name: 'CMC — Church Maintenance Coordinator',
      facility_name: org?.facility_name ?? '',
      role_label: ROLE_LABELS[targetRole] ?? targetRole,
      invited_by: appUser?.name?.trim() || appUser?.email?.trim() || 'An administrator',
    };
    if (org?.logo_url) inviteData.logo_url = org.logo_url;

    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/accept-invite`,
        data: inviteData,
      });
    if (inviteErr) return json({ error: inviteErr.message }, 400);

    // The on_auth_user_created trigger created the public.users row with role 'requester'.
    // Promote to the requested role now if it differs.
    if (targetRole !== 'requester' && invited?.user?.id) {
      await supabaseAdmin.from('users').update({ role: targetRole }).eq('id', invited.user.id);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
