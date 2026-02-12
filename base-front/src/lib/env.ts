// src/lib/env.ts
// Centraliza lectura de variables VITE_* (Vite) con defaults seguros.

type EnvMap = Record<string, string | undefined>

function envMap(): EnvMap {
  return import.meta.env as unknown as EnvMap
}

export function mustGetEnv(key: string): string {
  const v = envMap()[key]
  if (!v) throw new Error(`Falta variable de entorno: ${key}`)
  return v
}

export function getEnv(key: string): string | undefined {
  return envMap()[key]
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback
  const s = v.trim().toLowerCase()
  return ['1', 'true', 'yes', 'y', 'on'].includes(s)
}

export const ENV = {
  // Obligatorias
  SUPABASE_URL: () => mustGetEnv('VITE_SUPABASE_URL'),
  SUPABASE_ANON_KEY: () => mustGetEnv('VITE_SUPABASE_ANON_KEY'),

  // Cerebro (se usará después para gate real)
  TENANTS_TABLE: getEnv('VITE_TENANTS_TABLE') ?? 'tenants',
  PROFILES_TABLE: getEnv('VITE_PROFILES_TABLE') ?? 'profiles',

  // ✅ Para esta fase: evitar bloqueo por tenant/empresa
  // Por defecto: false (no ejecuta TenantGate).
  TENANT_GATE_ENABLED: parseBool(getEnv('VITE_TENANT_GATE_ENABLED'), false),

  // ✅ Schema aislado de asistencia
  ATTENDANCE_SCHEMA: getEnv('VITE_ATTENDANCE_SCHEMA') ?? 'attendance'
} as const

