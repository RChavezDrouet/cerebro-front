import { supabase } from '@/config/supabase'

type ProvisionPayload = {
  tenant_id: string
  employee_id: string
  email: string
  temp_password?: string | null
  role?: string
  send_welcome_email?: boolean
}

export async function provisionEmployeeUser(payload: ProvisionPayload) {
  const { data, error } = await supabase.functions.invoke('base-create-employee-user', {
    body: {
      tenant_id: payload.tenant_id,
      employee_id: payload.employee_id,
      email: payload.email,
      password: payload.temp_password ?? null,
      role: payload.role ?? 'employee',
      send_welcome_email: payload.send_welcome_email ?? false,
    },
  })

  if (error) throw error
  return data
}
