import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(10),
  VITE_TENANT_GATE_ENABLED: z.string().optional().default('true'),
  VITE_TENANTS_TABLE: z.string().optional().default('tenants'),
  VITE_PROFILES_TABLE: z.string().optional().default('profiles'),
  VITE_ATTENDANCE_SCHEMA: z.string().optional().default('attendance')
})

export const env = schema.parse(import.meta.env)
