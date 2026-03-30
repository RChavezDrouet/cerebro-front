import React, { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Save, Server, ShieldCheck } from 'lucide-react'
import { useToast } from '../../hooks'
import { getSingletonRow, upsertSingletonRow } from '../../services/singleton'

const schema = z.object({
  host: z.string().min(1, 'Host requerido'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1, 'Usuario requerido'),
  // Password opcional: si se deja vacío, no se sobreescribe
  password: z.string().optional(),
  from_email: z.string().email('Email inválido'),
  from_name: z.string().min(1, 'Nombre remitente requerido'),
  tls: z.boolean().default(true),
})

const normalizeRow = (row) => ({
  host: row?.host || '',
  port: row?.port || 587,
  username: row?.username || '',
  password: '',
  from_email: row?.from_email || '',
  from_name: row?.from_name || '',
  tls: row?.tls !== false,
})

export default function SmtpSettingsCard() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const defaultValues = useMemo(
    () => ({
      host: '',
      port: 587,
      username: '',
      password: '',
      from_email: '',
      from_name: '',
      tls: true,
    }),
    []
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    let mounted = true

    ;(async () => {
      setLoading(true)
      const row = await getSingletonRow('smtp_settings')
      if (!mounted) return
      reset(normalizeRow(row), { keepDirty: false })
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [reset])

  const onSubmit = async (values) => {
    setLoading(true)

    const patch = {
      host: values.host,
      port: values.port,
      username: values.username,
      from_email: values.from_email,
      from_name: values.from_name,
      tls: !!values.tls,
    }

    // Solo actualizar password si se ingresó
    if (values.password && values.password.trim().length > 0) {
      patch.password_ciphertext = values.password
    }

    const { data } = await upsertSingletonRow('smtp_settings', patch)
    setLoading(false)

    if (!data) {
      toast.warning('SMTP guardado parcialmente (revisa tablas/columnas en Supabase)')
      return
    }

    reset(normalizeRow(data), { keepDirty: false })
    toast.success('SMTP guardado')
  }

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Correo SMTP</h2>
        <p className="text-sm text-slate-500">
          Configuración del correo corporativo de salida. Por seguridad, el password no se muestra.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Host</label>
            <div className="relative">
              <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input-field pl-10" placeholder="smtp.tuempresa.com" {...register('host')} />
            </div>
            {errors.host && <p className="text-xs text-danger-600 mt-1">{errors.host.message}</p>}
          </div>

          <div>
            <label className="input-label">Puerto</label>
            <input type="number" className="input-field" placeholder="587" {...register('port')} />
            {errors.port && <p className="text-xs text-danger-600 mt-1">{errors.port.message}</p>}
          </div>

          <div>
            <label className="input-label">Usuario</label>
            <input className="input-field" placeholder="usuario@tuempresa.com" {...register('username')} />
            {errors.username && <p className="text-xs text-danger-600 mt-1">{errors.username.message}</p>}
          </div>

          <div>
            <label className="input-label">Password (solo si deseas cambiarlo)</label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="password" className="input-field pl-10" placeholder="••••••••" {...register('password')} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Recomendación OWASP: no persistir secretos en el frontend. Ideal: Vault/Secrets + Edge Function.
            </p>
          </div>

          <div>
            <label className="input-label">Remitente (email)</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input-field pl-10" placeholder="no-reply@tuempresa.com" {...register('from_email')} />
            </div>
            {errors.from_email && <p className="text-xs text-danger-600 mt-1">{errors.from_email.message}</p>}
          </div>

          <div>
            <label className="input-label">Remitente (nombre)</label>
            <input className="input-field" placeholder="Cerebro" {...register('from_name')} />
            {errors.from_name && <p className="text-xs text-danger-600 mt-1">{errors.from_name.message}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input id="tls" type="checkbox" className="rounded border-slate-300" {...register('tls')} />
          <label htmlFor="tls" className="text-sm text-slate-700">
            Usar TLS/STARTTLS
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={loading || !isDirty}>
            <Save className="w-4 h-4" />
            Guardar SMTP
          </button>
        </div>

        {loading && <p className="text-sm text-slate-500">Guardando/cargando…</p>}
      </form>
    </div>
  )
}
