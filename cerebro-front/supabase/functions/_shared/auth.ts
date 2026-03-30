import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CEREBRO_SCHEMA = (Deno.env.get('CEREBRO_SCHEMA') ?? 'public').trim()

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    '[Edge] Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set them in Supabase Edge Secrets.'
  )
}

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { user: null, error: 'Missing Bearer token' }

  const { data, error } = await adminClient.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'Invalid JWT' }

  return { user: data.user, error: null }
}

export async function requireStaffRole(email: string, allowed: string[]) {
  const e = normalizeEmail(email)

  const { data, error } = await adminClient
    .schema(CEREBRO_SCHEMA)
    .from('user_roles')
    .select('role')
    .eq('email', e)
    .maybeSingle()

  if (error) return { ok: false, role: null, error: error.message }
  if (!data?.role) return { ok: false, role: null, error: 'Role not found' }
  if (!allowed.includes(String(data.role))) return { ok: false, role: data.role, error: 'Forbidden' }

  return { ok: true, role: data.role, error: null }
}
