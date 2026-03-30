import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { json, corsHeaders } from '../_shared/cors.ts';
import { requireUser, adminClient } from '../_shared/auth.ts';
import { assertEmail } from '../_shared/security.ts';

/**
 * base-reset-password
 * Tenant admin can trigger Supabase reset password email flow.
 * Uses Supabase Auth built-in reset. This function just enforces tenant_admin permissions.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { user, error } = await requireUser(req);
    if (error || !user) return json({ error: 'Unauthorized' }, 401);

    const role = (user.user_metadata?.role ?? user.app_metadata?.role) as string | undefined;
    if (role !== 'tenant_admin') return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const email = assertEmail(body.email, 'email');
    const redirectTo = body.redirectTo ?? null;

    const { error: rErr } = await adminClient.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (rErr) throw rErr;

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
