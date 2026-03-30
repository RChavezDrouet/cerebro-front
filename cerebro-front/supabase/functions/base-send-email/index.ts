import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { json, corsHeaders } from '../_shared/cors.ts';
import { requireUser, adminClient } from '../_shared/auth.ts';
import { assertEmail, assertString } from '../_shared/security.ts';

// NOTE: This is a reference implementation. You must set SMTP secrets in Supabase Edge Secrets.
// For production: prefer a dedicated email provider (SendGrid/Mailgun) or Supabase SMTP with strict allowlists.

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { user, error } = await requireUser(req);
    if (error || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const tenant_id = assertString(body.tenant_id, 'tenant_id', 60);
    const to_email = assertEmail(body.to_email, 'to_email');
    const subject = assertString(body.subject, 'subject', 180);
    const html = assertString(body.html, 'html', 20000);

    // Resolve tenant SMTP config with fallback to global app_settings
    const { data: cfg } = await adminClient
      .schema('attendance')
      .from('base_tenant_config')
      .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure, smtp_from_name, smtp_from_email, smtp_verified')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    const smtp = cfg?.smtp_verified ? cfg : null;

    const { data: global } = await adminClient
      .from('app_settings')
      .select('smtp_host, smtp_port, smtp_email, smtp_password')
      .eq('id', 1)
      .maybeSingle();

    const host = smtp?.smtp_host ?? global?.smtp_host;
    const port = smtp?.smtp_port ?? global?.smtp_port;
    const userS = smtp?.smtp_user ?? global?.smtp_email;
    const pass = smtp?.smtp_password ?? global?.smtp_password;

    if (!host || !port || !userS || !pass) {
      return json({ error: 'SMTP not configured (tenant or global)' }, 400);
    }

    // Very small SMTP sender using SMTP2GO-compatible HTTP API is recommended.
    // Here we only log the intent to send.
    await adminClient.from('audit_logs').insert({
      action: 'EMAIL_SEND_REQUEST',
      user_id: user.id,
      tenant_id,
      description: `Email requested to ${to_email}: ${subject}`,
      meta: { host, port, from: smtp?.smtp_from_email ?? userS },
    });

    return json({ ok: true, note: 'Email sending implementation is a stub; wire to your SMTP provider.' }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
