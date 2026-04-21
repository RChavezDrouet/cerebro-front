import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(10),
  VITE_TENANT_GATE_ENABLED: z.string().optional().default('true'),
  VITE_TENANTS_TABLE: z.string().optional().default('tenants'),
  VITE_PROFILES_TABLE: z.string().optional().default('profiles'),
  VITE_ATTENDANCE_SCHEMA: z.string().optional().default('attendance'),
  VITE_APP_BUILD_SHA: z.string().optional(),
  VITE_APP_BUILD_REF: z.string().optional(),
  VITE_APP_BUILD_TIME: z.string().optional(),
})

export const env = schema.parse(import.meta.env)
