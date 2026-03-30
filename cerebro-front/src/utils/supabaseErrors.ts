export type SupabaseErrorKind = 'schema_cache' | 'rls' | 'not_found' | 'unknown'

const parseMissingColumn = (msg: string) => {
  // PostgREST: Could not find the 'company_ruc' column of 'app_settings' in the schema cache
  const m = msg.match(/Could not find the '(.+?)' column of '(.+?)'/i)
  if (!m?.[1]) return null
  return { column: m[1], table: m?.[2] || '' }
}

export const isSchemaCacheError = (err: any) => {
  const code = String((err as any)?.code || '')
  const msg = String(err?.message || err?.details || err || '')
  const m = msg.toLowerCase()

  // PostgREST / Postgres codes seen in Supabase
  if (code === 'PGRST204') return true // "Could not find the table ... in the schema cache"
  if (code === '42P01') return true // relation does not exist

  // Strong signals
  if (m.includes('schema cache')) return true
  if (m.includes('could not find the table')) return true

  // Relation does not exist (but NOT permission denied for relation)
  if (/relation\s+.+\s+does not exist/i.test(msg)) return true

  // Generic "does not exist" can be too broad; keep it but avoid column errors.
  if (m.includes('does not exist') && !m.includes('column')) return true

  return false
}

export const isRlsError = (err: any) => {
  const code = String((err as any)?.code || '')
  const msg = String(err?.message || err?.details || err || '').toLowerCase()
  // 42501 = insufficient_privilege (incluye "permission denied")
  return (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('insufficient privilege') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  )
}

export const formatSupabaseError = (err: any) => {
  const msg = String(err?.message || err?.details || err || 'Error')

  const missing = parseMissingColumn(msg)
  if (missing) {
    return {
      kind: 'schema_cache' as SupabaseErrorKind,
      title: `Falta columna en BD: ${missing.column}`,
      detail: msg,
      hint: `Agrega la columna faltante en ${missing.table || 'la tabla'} (ejecuta supabase/sql/01_tables.sql o un ALTER TABLE) y luego recarga el API schema en Supabase (Settings → API → Reload schema).`,
    }
  }

  if (isSchemaCacheError(err)) {
    return {
      kind: 'schema_cache' as SupabaseErrorKind,
      title: 'Esquema no disponible (migraciones / cache)',
      detail: msg,
      hint:
        'Ejecuta las migraciones SQL del repo (supabase/sql) y recarga el schema del API en Supabase (Settings → API → Reload schema).',
    }
  }

  if (isRlsError(err)) {
    return {
      kind: 'rls' as SupabaseErrorKind,
      title: 'Permiso denegado (RLS)',
      detail: msg,
      hint: 'Aplica 02_rls.sql y 03_grants.sql (GRANT a authenticated). Verifica user_roles (email → admin). Luego recarga API schema y reintenta.',
    }
  }

  if ((err as any)?.status === 404 || msg.toLowerCase().includes('not found')) {
    return {
      kind: 'not_found' as SupabaseErrorKind,
      title: 'Recurso no encontrado',
      detail: msg,
      hint: 'Si es una Edge Function, verifica que esté desplegada y publicada. Si es una tabla, revisa migraciones.',
    }
  }

  return { kind: 'unknown' as SupabaseErrorKind, title: 'Error', detail: msg, hint: 'Revisa consola y logs.' }
}
