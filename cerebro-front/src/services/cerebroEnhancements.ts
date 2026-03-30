import { supabase } from '../config/supabase'
import { getSingletonRow, upsertSingletonRow } from './singleton'

const LS_KEYS = {
  products: 'cerebro:catalog:products',
  rates: 'cerebro:catalog:rates',
  storage: 'cerebro:storage:settings',
  lifecycle: 'cerebro:lifecycle:settings',
  biometricRuns: 'cerebro:biometric:runs',
}

const safeArray = (value: any) => (Array.isArray(value) ? value : [])

const readLS = (key: string, fallback: any) => {
  try {
    if (typeof window === 'undefined') return fallback
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const writeLS = (key: string, value: any) => {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export const APPEARANCE_DEFAULTS = {
  button_radius: 18,
  button_style: 'gradient',
  button_text_transform: 'none',
  surface_style: 'glass',
  background_type: 'gradient',
  background_color: '#020617',
  background_image_url: '',
  background_overlay_opacity: 0.2,
}

export async function loadAppearanceSettings() {
  const row: any = (await getSingletonRow('app_settings')) || {}
  return {
    ...APPEARANCE_DEFAULTS,
    primary_color: row.primary_color || '#00e673',
    secondary_color: row.secondary_color || '#00b3ff',
    accent_color: row.accent_color || '#7c3aed',
    button_radius: Number(row.button_radius ?? APPEARANCE_DEFAULTS.button_radius),
    button_style: row.button_style || APPEARANCE_DEFAULTS.button_style,
    button_text_transform: row.button_text_transform || APPEARANCE_DEFAULTS.button_text_transform,
    surface_style: row.surface_style || APPEARANCE_DEFAULTS.surface_style,
    background_type: row.background_type || APPEARANCE_DEFAULTS.background_type,
    background_color: row.background_color || APPEARANCE_DEFAULTS.background_color,
    background_image_url: row.background_image_url || '',
    background_overlay_opacity: Number(row.background_overlay_opacity ?? APPEARANCE_DEFAULTS.background_overlay_opacity),
  }
}

export async function saveAppearanceSettings(payload: any) {
  return upsertSingletonRow('app_settings', {
    primary_color: payload.primary_color,
    secondary_color: payload.secondary_color,
    accent_color: payload.accent_color,
    button_radius: Number(payload.button_radius ?? 18),
    button_style: payload.button_style,
    button_text_transform: payload.button_text_transform,
    surface_style: payload.surface_style,
    background_type: payload.background_type,
    background_color: payload.background_color,
    background_image_url: payload.background_image_url || null,
    background_overlay_opacity: Number(payload.background_overlay_opacity ?? 0.2),
  })
}

const defaultProducts = [
  {
    id: 'product-attendance',
    code: 'ATTENDANCE',
    name: 'Control de marcaciones',
    description: 'Módulo de asistencia, marcaciones web y biométricas.',
    billing_mode: 'package_or_consumption',
    active: true,
  },
  {
    id: 'product-payroll',
    code: 'PAYROLL_PERFORMANCE',
    name: 'Nómina con evaluación de desempeño',
    description: 'Módulo de nómina y desempeño, cobro por empleados gestionados.',
    billing_mode: 'package_or_consumption',
    active: true,
  },
]

const defaultRates = [
  {
    id: 'rate-attendance-basic',
    product_id: 'product-attendance',
    name: 'Plan básico 1-100 usuarios',
    pricing_type: 'package',
    min_users: 1,
    max_users: 100,
    flat_price: 99,
    unit_price: 0,
    currency: 'USD',
    active: true,
    notes: 'Paquete ejemplo para control de marcaciones.',
  },
  {
    id: 'rate-attendance-consumption',
    product_id: 'product-attendance',
    name: 'Consumo por usuario que marca',
    pricing_type: 'consumption',
    min_users: 1,
    max_users: null,
    flat_price: 0,
    unit_price: 1.15,
    currency: 'USD',
    active: true,
    notes: 'Se factura por usuario que registra marcación.',
  },
  {
    id: 'rate-payroll-basic',
    product_id: 'product-payroll',
    name: 'Plan básico nómina 1-100 empleados',
    pricing_type: 'package',
    min_users: 1,
    max_users: 100,
    flat_price: 149,
    unit_price: 0,
    currency: 'USD',
    active: true,
    notes: 'Paquete ejemplo para nómina con evaluación.',
  },
]

export async function loadProductCatalog() {
  try {
    const { data: products, error: pErr } = await supabase
      .from('cerebro_products')
      .select('*')
      .order('created_at', { ascending: true })

    if (pErr) throw pErr

    const { data: rates, error: rErr } = await supabase
      .from('cerebro_product_rates')
      .select('*')
      .order('created_at', { ascending: true })

    if (rErr) throw rErr

    return {
      source: 'database',
      products: safeArray(products),
      rates: safeArray(rates),
    }
  } catch {
    const products = readLS(LS_KEYS.products, defaultProducts)
    const rates = readLS(LS_KEYS.rates, defaultRates)
    return {
      source: 'localStorage',
      products,
      rates,
    }
  }
}

export async function saveProductCatalog(products: any[], rates: any[]) {
  try {
    const normalizedProducts = safeArray(products).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || null,
      billing_mode: row.billing_mode || 'package_or_consumption',
      active: row.active !== false,
    }))

    const normalizedRates = safeArray(rates).map((row: any) => ({
      id: row.id,
      product_id: row.product_id,
      name: row.name,
      pricing_type: row.pricing_type || 'package',
      min_users: row.min_users == null ? null : Number(row.min_users),
      max_users: row.max_users == null || row.max_users === '' ? null : Number(row.max_users),
      flat_price: Number(row.flat_price || 0),
      unit_price: Number(row.unit_price || 0),
      currency: row.currency || 'USD',
      active: row.active !== false,
      notes: row.notes || null,
    }))

    const { error: pErr } = await supabase.from('cerebro_products').upsert(normalizedProducts, { onConflict: 'id' })
    if (pErr) throw pErr

    const { error: rErr } = await supabase.from('cerebro_product_rates').upsert(normalizedRates, { onConflict: 'id' })
    if (rErr) throw rErr

    return { ok: true, source: 'database' }
  } catch {
    writeLS(LS_KEYS.products, products)
    writeLS(LS_KEYS.rates, rates)
    return { ok: true, source: 'localStorage' }
  }
}

export async function loadTenantOptions() {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id,name,status,contact_email,created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return safeArray(data)
  } catch {
    return []
  }
}

export async function loadBiometricDevices(tenantId?: string | null) {
  try {
    let query = supabase
      .schema('attendance')
      .from('biometric_devices')
      .select('*')
      .order('created_at', { ascending: false })

    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { data, error } = await query
    if (error) throw error
    return safeArray(data)
  } catch {
    return []
  }
}

export async function runBiometricDiagnostic(input: any) {
  const tenantId = input?.tenant_id || null
  const serial = String(input?.serial_no || '').trim()
  const windowMinutes = Number(input?.window_minutes || 15)

  const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const devices = await loadBiometricDevices(tenantId)
  const device = devices.find((row: any) => {
    const serials = [
      row?.serial_no,
      row?.serial,
      row?.sn,
      row?.device_serial,
    ].map((v) => String(v || '').trim())
    return serial ? serials.includes(serial) : true
  }) || null

  let rawRows: any[] = []
  let punchRows: any[] = []
  let recordRows: any[] = []

  try {
    const { data } = await supabase.schema('attendance').from('biometric_raw').select('*').gte('created_at', sinceIso).limit(20)
    rawRows = safeArray(data).filter((row: any) => {
      const serials = [row?.serial_no, row?.serial, row?.sn, row?.device_serial, row?.meta?.sn].map((v) => String(v || '').trim())
      return serial ? serials.includes(serial) : true
    })
  } catch {
    rawRows = []
  }

  try {
    const { data } = await supabase.schema('attendance').from('punches').select('*').gte('created_at', sinceIso).limit(20)
    punchRows = safeArray(data).filter((row: any) => {
      const serials = [row?.serial_no, row?.serial, row?.sn, row?.device_serial, row?.meta?.sn].map((v) => String(v || '').trim())
      return serial ? serials.includes(serial) : true
    })
  } catch {
    punchRows = []
  }

  try {
    const { data } = await supabase.schema('attendance').from('attendance_records').select('*').gte('created_at', sinceIso).limit(20)
    recordRows = safeArray(data).filter((row: any) => {
      const serials = [row?.serial_no, row?.serial, row?.sn, row?.device_serial, row?.meta?.sn].map((v) => String(v || '').trim())
      return serial ? serials.includes(serial) : true
    })
  } catch {
    recordRows = []
  }

  const heartbeat = [
    device?.last_seen_at,
    rawRows[0]?.created_at,
    punchRows[0]?.created_at,
    recordRows[0]?.created_at,
  ].filter(Boolean).sort().reverse()[0] || null

  const checks = [
    {
      key: 'device_registered',
      label: 'Biométrico registrado',
      status: !!device,
      detail: device ? `Serial reconocido: ${serial || device.serial_no || device.serial || device.sn || 'N/D'}` : 'No se encontró el equipo en attendance.biometric_devices',
    },
    {
      key: 'device_active',
      label: 'Equipo habilitado',
      status: device ? !(device.is_active === false || String(device.status || '').toLowerCase() === 'inactive') : false,
      detail: device ? `Estado: ${device.status || (device.is_active === false ? 'inactive' : 'active')}` : 'Sin equipo para validar',
    },
    {
      key: 'gateway_capture',
      label: 'Gateway capturando',
      status: rawRows.length > 0,
      detail: rawRows.length ? `${rawRows.length} evento(s) raw detectados en ventana de ${windowMinutes} min.` : 'No se detectaron eventos raw recientes.',
    },
    {
      key: 'punch_persisted',
      label: 'Marcación persistida',
      status: punchRows.length > 0,
      detail: punchRows.length ? `${punchRows.length} registro(s) en attendance.punches.` : 'No se detectaron registros recientes en attendance.punches.',
    },
    {
      key: 'attendance_record',
      label: 'Asistencia consolidada',
      status: recordRows.length > 0,
      detail: recordRows.length ? `${recordRows.length} registro(s) en attendance.attendance_records.` : 'Sin consolidación reciente en attendance.attendance_records.',
    },
  ]

  const result = {
    id: `bio-test-${Date.now()}`,
    tenant_id: tenantId,
    serial_no: serial || device?.serial_no || device?.serial || device?.sn || '',
    window_minutes: windowMinutes,
    executed_at: new Date().toISOString(),
    last_heartbeat_at: heartbeat,
    overall_status: checks.every((c) => c.status) ? 'healthy' : checks.some((c) => c.status) ? 'warning' : 'critical',
    checks,
    samples: {
      device,
      rawRows,
      punchRows,
      recordRows,
    },
  }

  try {
    const previous = readLS(LS_KEYS.biometricRuns, [])
    writeLS(LS_KEYS.biometricRuns, [result, ...previous].slice(0, 20))
  } catch {
    // ignore
  }

  try {
    await supabase.from('biometric_test_runs').insert({
      id: result.id,
      tenant_id: result.tenant_id,
      serial_no: result.serial_no,
      window_minutes: result.window_minutes,
      executed_at: result.executed_at,
      overall_status: result.overall_status,
      payload: result,
    })
  } catch {
    // tabla opcional
  }

  return result
}

export async function loadBiometricHistory() {
  try {
    const { data, error } = await supabase
      .from('biometric_test_runs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return safeArray(data)
  } catch {
    return readLS(LS_KEYS.biometricRuns, [])
  }
}

const STORAGE_DEFAULTS = {
  enabled: true,
  threshold_gb: 8,
  threshold_percent: 80,
  notify_emails: '',
}

export async function loadStorageSettings() {
  const row: any = (await getSingletonRow('storage_alert_settings')) || readLS(LS_KEYS.storage, STORAGE_DEFAULTS)
  return {
    ...STORAGE_DEFAULTS,
    enabled: row.enabled !== false,
    threshold_gb: Number(row.threshold_gb ?? STORAGE_DEFAULTS.threshold_gb),
    threshold_percent: Number(row.threshold_percent ?? STORAGE_DEFAULTS.threshold_percent),
    notify_emails: row.notify_emails || '',
  }
}

export async function saveStorageSettings(payload: any) {
  const normalized = {
    enabled: payload.enabled !== false,
    threshold_gb: Number(payload.threshold_gb || 0),
    threshold_percent: Number(payload.threshold_percent || 0),
    notify_emails: payload.notify_emails || '',
  }

  const result = await upsertSingletonRow('storage_alert_settings', normalized)
  if (!result?.data && result?.reason) {
    writeLS(LS_KEYS.storage, normalized)
    return { ok: true, source: 'localStorage' }
  }
  return { ok: true, source: 'database' }
}

export async function loadStorageUsage() {
  const tenants = await loadTenantOptions()

  try {
    const { data, error } = await supabase
      .from('tenant_storage_usage')
      .select('*')
      .order('measured_at', { ascending: false })

    if (error) throw error

    const rows = safeArray(data)
    if (!rows.length) {
      return tenants.map((tenant: any) => ({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        used_gb: 0,
        quota_gb: 0,
        measured_at: null,
        source: 'empty',
      }))
    }

    return rows.map((row: any) => ({
      ...row,
      tenant_name: row.tenant_name || tenants.find((t: any) => t.id === row.tenant_id)?.name || row.tenant_id,
      source: 'database',
    }))
  } catch {
    return tenants.map((tenant: any, index: number) => ({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      used_gb: Number((index * 0.37 + 0.15).toFixed(2)),
      quota_gb: 10,
      measured_at: null,
      source: 'estimated',
    }))
  }
}

const LIFECYCLE_DEFAULTS = {
  paused_months_before_deactivation: 6,
  allow_manual_suspend: true,
  dar_format: 'json',
}

export async function loadLifecycleSettings() {
  const row: any = (await getSingletonRow('tenant_lifecycle_settings')) || readLS(LS_KEYS.lifecycle, LIFECYCLE_DEFAULTS)
  return {
    ...LIFECYCLE_DEFAULTS,
    paused_months_before_deactivation: Number(row.paused_months_before_deactivation ?? LIFECYCLE_DEFAULTS.paused_months_before_deactivation),
    allow_manual_suspend: row.allow_manual_suspend !== false,
    dar_format: row.dar_format || 'json',
  }
}

export async function saveLifecycleSettings(payload: any) {
  const normalized = {
    paused_months_before_deactivation: Number(payload.paused_months_before_deactivation || 0),
    allow_manual_suspend: payload.allow_manual_suspend !== false,
    dar_format: payload.dar_format || 'json',
  }

  const result = await upsertSingletonRow('tenant_lifecycle_settings', normalized)
  if (!result?.data && result?.reason) {
    writeLS(LS_KEYS.lifecycle, normalized)
    return { ok: true, source: 'localStorage' }
  }
  return { ok: true, source: 'database' }
}

export async function updateTenantLifecycleStatus(tenant: any, nextStatus: string) {
  const patch: any = { status: nextStatus }
  if (nextStatus === 'paused') patch.paused_at = new Date().toISOString()
  if (nextStatus === 'active') patch.reactivated_at = new Date().toISOString()
  if (nextStatus === 'suspended') patch.suspended_at = new Date().toISOString()
  if (nextStatus === 'deactivated') patch.deactivated_at = new Date().toISOString()

  const { error } = await supabase.from('tenants').update(patch).eq('id', tenant.id)
  if (error) throw error
  return true
}

export function monthsPaused(tenant: any) {
  const pausedAt = tenant?.paused_at || tenant?.updated_at || null
  if (!pausedAt) return 0
  const diffMs = Date.now() - new Date(pausedAt).getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30))
}

export function buildDarPayload(tenant: any, settings: any) {
  return {
    export_type: 'DAR',
    generated_at: new Date().toISOString(),
    tenant: {
      id: tenant?.id,
      name: tenant?.name,
      status: tenant?.status,
      contact_email: tenant?.contact_email,
      plan: tenant?.plan,
      paused_at: tenant?.paused_at || null,
      suspended_at: tenant?.suspended_at || null,
      deactivated_at: tenant?.deactivated_at || null,
    },
    policy: {
      paused_months_before_deactivation: settings?.paused_months_before_deactivation,
      dar_format: settings?.dar_format || 'json',
    },
    note: 'Este paquete DAR contiene metadatos del tenant. La copia completa de datos debe ejecutarse en backend y luego transferirse manualmente a un USB autorizado.',
  }
}