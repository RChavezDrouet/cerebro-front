import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const body = await req.json()

  const { data, error } = await admin.from('audit_logs').insert({
    tenant_id: body.tenant_id ?? null,
    actor_user_id: body.actor_user_id ?? null,
    actor_email: body.actor_email ?? null,
    module: body.module,
    action: body.action,
    entity_name: body.entity_name,
    entity_id: body.entity_id ?? null,
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    metadata: body.metadata ?? {},
  }).select('*').single()

  return new Response(JSON.stringify({ ok: !error, data, error: error?.message ?? null }), {
    status: error ? 400 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
