import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { json, corsHeaders } from '../_shared/cors.ts';
import { adminClient } from '../_shared/auth.ts';
import { assertString } from '../_shared/security.ts';

/**
 * biometric-gatekeeper
 * Validates if a biometric device serial is authorized for a tenant.
 * Intended for gateways / importers.
 * Auth: by API key (edge secret BIOMETRIC_GATEKEEPER_KEY) or service-to-service.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const apiKey = req.headers.get('x-api-key');
    const expected = Deno.env.get('BIOMETRIC_GATEKEEPER_KEY');
    if (!expected || apiKey !== expected) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const tenant_id = assertString(body.tenant_id, 'tenant_id', 60);
    const serial_number = assertString(body.serial_number, 'serial_number', 80);

    const { data, error } = await adminClient
      .from('biometric_devices')
      .select('id,is_active')
      .eq('tenant_id', tenant_id)
      .eq('serial_number', serial_number)
      .maybeSingle();

    if (error) throw error;
    const allowed = !!data?.id && data.is_active === true;

    return json({ allowed }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
