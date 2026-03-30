import { supabase } from '@/config/supabase'

export async function whoami() {
  const { data: u, error: ue } = await supabase.auth.getUser()
  console.log('[AUTH.getUser]', { ue, user: u?.user })

  const email = u?.user?.email
  if (!email) return

  const { data: roleRow, error: re } = await supabase
    .from('user_roles')
    .select('role, full_name, email')
    .eq('email', email)
    .maybeSingle()

  console.log('[user_roles]', { re, roleRow })
}