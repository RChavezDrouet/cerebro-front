/**
 * ==============================================
 * CEREBRO SaaS - Helpers para tablas singleton
 * ==============================================
 *
 * Tablas "singleton": una sola fila (id=1) para settings.
 * Robustez:
 * - si falta una columna en DB, se elimina del payload y se reintenta.
 * - si la tabla no existe / schema cache, retorna null sin romper.
 */

import { supabase } from '../config/supabase'

const isSchemaCacheError = (err) => {
  const code = String(err?.code || '')
  const msg = String(err?.message || err?.details || '')
  const m = msg.toLowerCase()

  if (code === 'PGRST204') return true
  if (code === '42P01') return true
  if (m.includes('schema cache')) return true
  if (m.includes('could not find the table')) return true
  if (/relation\s+.+\s+does not exist/i.test(msg)) return true
  if (m.includes('does not exist') && !m.includes('column')) return true
  return false
}

const isRlsError = (err) => {
  const code = String(err?.code || '')
  const msg = String(err?.message || err?.details || '').toLowerCase()
  return (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('insufficient privilege') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  )
}

/**
 * Obtiene la fila singleton (id=1) o la primera fila disponible.
 */
export const getSingletonRow = async (table, select = '*') => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (isSchemaCacheError(error)) return null
      throw error
    }

    return data ?? null
  } catch (e) {
    if (isSchemaCacheError(e)) return null
    console.warn(`getSingletonRow(${table}) error:`, e)
    return null
  }
}

/**
 * Upsert singleton (id=1), eliminando columnas faltantes si aplica.
 */
export const upsertSingletonRow = async (table, patch, id = 1) => {
  let payload = { id, ...patch }
  const removedColumns = []

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { data, error } = await supabase
        .from(table)
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle()

      if (!error) return { data: data ?? null, removedColumns }

      const msg = error?.message || ''
      const match = msg.match(/column "(.+?)" does not exist/i)
      if (match?.[1]) {
        const missingCol = match[1]
        delete payload[missingCol]
        removedColumns.push(missingCol)
        continue
      }

      // PostgREST schema cache: Could not find the 'X' column of 'table' in the schema cache
      const m2 = msg.match(/Could not find the '(.+?)' column of/i)
      if (m2?.[1]) {
        const missingCol = m2[1]
        delete payload[missingCol]
        removedColumns.push(missingCol)
        continue
      }

      if (isSchemaCacheError(error)) return { data: null, removedColumns, reason: 'schema_cache', error }
      if (isRlsError(error)) return { data: null, removedColumns, reason: 'rls', error }
      throw error
    } catch (e) {
      if (isSchemaCacheError(e)) return { data: null, removedColumns, reason: 'schema_cache', error: e }
      if (isRlsError(e)) return { data: null, removedColumns, reason: 'rls', error: e }
      console.warn(`upsertSingletonRow(${table}) error:`, e)
      return { data: null, removedColumns, reason: 'unknown', error: e }
    }
  }

  return { data: null, removedColumns, reason: 'unknown', error: null }
}
