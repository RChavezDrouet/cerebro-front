// src/pages/config/FacialRecognitionPage.tsx
// v4.5.1 - Módulo de Reconocimiento Facial
// FIX:
// - removido import inexistente facialRecognitionConfigSchema
// - guardado directo contra attendance.facial_recognition_config
// - se mantiene compatibilidad con FACIAL_CONFIG_DEFAULTS y FacialRecognitionConfig

import React, { useState, useEffect, useRef } from 'react'
import {
  Camera,
  Sliders,
  ShieldCheck,
  Eye,
  Sun,
  Contrast,
  Focus,
  Maximize2,
  RotateCcw,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
} from 'lucide-react'
import { supabase } from '@/config/supabase'
import { resolveTenantId } from '@/lib/tenant'
import type { FacialRecognitionConfig } from '@/pages/employees/employeeSchemas'
import { FACIAL_CONFIG_DEFAULTS } from '@/pages/employees/employeeSchemas'

const SliderField: React.FC<{
  label: string
  description?: string
  icon?: React.ReactNode
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  colorClass?: string
}> = ({
  label,
  description,
  icon,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  colorClass = 'bg-blue-500',
}) => {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className="min-w-[4rem] text-right text-sm font-bold text-blue-600">
          {value}
          {unit}
        </span>
      </div>

      {description && <p className="text-xs text-gray-400">{description}</p>}

      <div className="relative h-2 rounded-full bg-gray-200">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-white shadow"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  )
}

const Toggle: React.FC<{
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  color?: string
}> = ({ label, description, checked, onChange, color = 'bg-blue-500' }) => (
  <label className="group flex cursor-pointer items-start gap-4">
    <div className="mt-0.5 flex-shrink-0">
      <div
        onClick={() => onChange(!checked)}
        className={`flex h-6 w-10 items-center rounded-full px-1 transition-colors ${
          checked ? color : 'bg-gray-300'
        }`}
      >
        <div
          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
    </div>
  </label>
)

const SectionCard: React.FC<{
  title: string
  subtitle?: string
  icon: React.ReactNode
  color: string
  children: React.ReactNode
}> = ({ title, subtitle, icon, color, children }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className={`flex items-center gap-3 border-b border-gray-100 px-6 py-4 ${color}`}>
      <div className="rounded-lg bg-white/30 p-2">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-6 p-6">{children}</div>
  </div>
)

const QualityPreview: React.FC<{ config: FacialRecognitionConfig }> = ({ config }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)
  const [metrics, setMetrics] = useState<{
    brightness: number
    contrast: number
    sharpness: number
  } | null>(null)

  const stopPreview = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setIsStreaming(false)
    setMetrics(null)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const analyzeFrame = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let totalBrightness = 0
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      totalBrightness += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }

    const brightness = Math.round(totalBrightness / pixelCount)

    let variance = 0
    for (let i = 0; i < data.length; i += 4) {
      const pb = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      variance += Math.pow(pb - brightness, 2)
    }

    const contrast = Math.round((Math.sqrt(variance / pixelCount) * 100) / 128)
    const sharpness = Math.min(100, Math.round(contrast * 1.2))

    setMetrics({ brightness, contrast, sharpness })
  }

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsStreaming(true)
        intervalRef.current = window.setInterval(() => analyzeFrame(), 500)
      }
    } catch {
      alert('No se pudo acceder a la cámara para la vista previa.')
    }
  }

  useEffect(() => {
    return () => stopPreview()
  }, [])

  const getStatus = (value: number, min: number, max?: number) => {
    if (value < min) return 'red'
    if (typeof max === 'number' && value > max) return 'red'
    return 'green'
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gray-900">
      <div className="flex items-center justify-between p-4">
        <p className="text-sm font-medium text-white">Vista previa en tiempo real</p>
        <button
          onClick={isStreaming ? stopPreview : startPreview}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            isStreaming ? 'bg-red-500 text-white' : 'bg-white text-gray-900'
          }`}
        >
          {isStreaming ? 'Detener' : 'Iniciar cámara'}
        </button>
      </div>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />

        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="h-12 w-12 text-gray-600" />
          </div>
        )}

        {isStreaming && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border-2 border-white/50 opacity-60" style={{ width: '55%', paddingTop: '55%' }} />
          </div>
        )}
      </div>

      {metrics && (
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            {
              label: 'Brillo',
              value: metrics.brightness,
              min: Number((config as any).min_brightness ?? 0),
              max: Number((config as any).max_brightness ?? 255),
              unit: '',
            },
            {
              label: 'Contraste',
              value: metrics.contrast,
              min: Number((config as any).min_contrast ?? 0),
              max: undefined,
              unit: '%',
            },
            {
              label: 'Nitidez',
              value: metrics.sharpness,
              min: Number((config as any).min_sharpness ?? 0),
              max: undefined,
              unit: '%',
            },
          ].map(({ label, value, min, max, unit }) => {
            const status = getStatus(value, min, max)

            return (
              <div key={label} className="rounded-xl bg-gray-800 p-3 text-center">
                <p className="mb-1 text-xs text-gray-400">{label}</p>
                <p className={`text-lg font-bold ${status === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                  {value}
                  {unit}
                </p>
                <div className="mt-1 flex items-center justify-center gap-1">
                  {status === 'green' ? (
                    <CheckCircle className="h-3 w-3 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-red-400" />
                  )}
                  <span className={`text-xs ${status === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                    {status === 'green' ? 'OK' : `Mín: ${min}${unit}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const FacialRecognitionPage: React.FC = () => {
  const [config, setConfig] = useState<FacialRecognitionConfig>(FACIAL_CONFIG_DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<'quality' | 'capture' | 'enforcement' | 'preview'>('quality')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('No autenticado')

      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant')

      const { data, error } = await supabase
        .schema('attendance')
        .from('facial_recognition_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) {
        console.error('Error cargando config facial:', error)
      }

      if (data) {
        setConfig({ ...FACIAL_CONFIG_DEFAULTS, ...(data as FacialRecognitionConfig) })
      } else {
        setConfig(FACIAL_CONFIG_DEFAULTS)
      }
    } catch (err) {
      console.error('Error cargando config facial:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const setField = <K extends keyof FacialRecognitionConfig>(
    key: K,
    value: FacialRecognitionConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleReset = () => {
    setConfig(FACIAL_CONFIG_DEFAULTS)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('No autenticado')

      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant')

      const payload = { ...config, tenant_id: tenantId }

      if ((config as any).id) {
        const { error } = await supabase
          .schema('attendance')
          .from('facial_recognition_config')
          .update(payload)
          .eq('id', (config as any).id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .schema('attendance')
          .from('facial_recognition_config')
          .insert(payload)

        if (error) throw error
      }

      setSaveStatus('success')
      await loadConfig()
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('Error guardando config:', err)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const tabs = [
    { id: 'quality', label: 'Calidad de Foto', icon: <Sliders className="h-4 w-4" /> },
    { id: 'capture', label: 'Captura', icon: <Camera className="h-4 w-4" /> },
    { id: 'enforcement', label: 'Aplicación', icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'preview', label: 'Vista Previa', icon: <Eye className="h-4 w-4" /> },
  ] as const

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            <Camera className="h-7 w-7 text-blue-600" />
            Reconocimiento Facial
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configura los parámetros de calidad de fotografía y reconocimiento facial para tu empresa.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Restablecer
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>

      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          Configuración guardada exitosamente
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Error al guardar. Intenta de nuevo.
        </div>
      )}

      <div className="flex gap-2 rounded-2xl bg-gray-100 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'quality' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-xs text-blue-700">
              Estos parámetros definen cuándo una fotografía es aceptable. Se aplican tanto al registrar
              empleados como al marcar asistencia, según la política del tenant.
            </p>
          </div>

          <SectionCard
            title="Brillo"
            subtitle="Nivel de luminosidad de la imagen"
            icon={<Sun className="h-4 w-4 text-white" />}
            color="bg-amber-400 text-white"
          >
            <SliderField
              label="Brillo mínimo"
              description="Valor mínimo aceptado para considerar la imagen usable."
              icon={<Sun className="h-4 w-4" />}
              value={Number((config as any).min_brightness ?? 40)}
              min={0}
              max={255}
              onChange={(v) => setField('min_brightness' as keyof FacialRecognitionConfig, v as any)}
              unit=""
              colorClass="bg-amber-500"
            />
            <SliderField
              label="Brillo máximo"
              description="Evita imágenes sobreexpuestas."
              icon={<Sun className="h-4 w-4" />}
              value={Number((config as any).max_brightness ?? 220)}
              min={0}
              max={255}
              onChange={(v) => setField('max_brightness' as keyof FacialRecognitionConfig, v as any)}
              unit=""
              colorClass="bg-yellow-500"
            />
          </SectionCard>

          <SectionCard
            title="Contraste"
            subtitle="Separación tonal entre rostro y fondo"
            icon={<Contrast className="h-4 w-4 text-white" />}
            color="bg-violet-500 text-white"
          >
            <SliderField
              label="Contraste mínimo"
              description="A mayor contraste, mejor diferenciación facial."
              icon={<Contrast className="h-4 w-4" />}
              value={Number((config as any).min_contrast ?? 20)}
              min={0}
              max={100}
              onChange={(v) => setField('min_contrast' as keyof FacialRecognitionConfig, v as any)}
              unit="%"
              colorClass="bg-violet-500"
            />
          </SectionCard>

          <SectionCard
            title="Nitidez"
            subtitle="Definición de contornos faciales"
            icon={<Focus className="h-4 w-4 text-white" />}
            color="bg-cyan-500 text-white"
          >
            <SliderField
              label="Nitidez mínima"
              description="Asegura que la imagen no esté demasiado borrosa."
              icon={<Focus className="h-4 w-4" />}
              value={Number((config as any).min_sharpness ?? 20)}
              min={0}
              max={100}
              onChange={(v) => setField('min_sharpness' as keyof FacialRecognitionConfig, v as any)}
              unit="%"
              colorClass="bg-cyan-500"
            />
          </SectionCard>

          <SectionCard
            title="Resolución"
            subtitle="Tamaño mínimo de imagen"
            icon={<Maximize2 className="h-4 w-4 text-white" />}
            color="bg-emerald-500 text-white"
          >
            <SliderField
              label="Ancho mínimo"
              description="Pixeles mínimos de ancho."
              value={Number((config as any).min_width_px ?? 200)}
              min={100}
              max={1000}
              step={10}
              onChange={(v) => setField('min_width_px' as keyof FacialRecognitionConfig, v as any)}
              unit="px"
              colorClass="bg-emerald-500"
            />
            <SliderField
              label="Alto mínimo"
              description="Pixeles mínimos de alto."
              value={Number((config as any).min_height_px ?? 200)}
              min={100}
              max={1000}
              step={10}
              onChange={(v) => setField('min_height_px' as keyof FacialRecognitionConfig, v as any)}
              unit="px"
              colorClass="bg-green-500"
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'capture' && (
        <div className="space-y-5">
          <SectionCard
            title="Captura"
            subtitle="Controles durante la toma de fotografía"
            icon={<Camera className="h-4 w-4 text-white" />}
            color="bg-blue-600 text-white"
          >
            <Toggle
              label="Requerir cámara frontal"
              description="Sugiere el uso de la cámara frontal en dispositivos móviles."
              checked={Boolean((config as any).prefer_front_camera ?? true)}
              onChange={(v) => setField('prefer_front_camera' as keyof FacialRecognitionConfig, v as any)}
              color="bg-blue-500"
            />
            <Toggle
              label="Permitir reintentos"
              description="Permite que el usuario repita la captura si no cumple calidad."
              checked={Boolean((config as any).allow_retry ?? true)}
              onChange={(v) => setField('allow_retry' as keyof FacialRecognitionConfig, v as any)}
              color="bg-blue-500"
            />
            <SliderField
              label="Máximo de intentos"
              description="Cantidad máxima de reintentos de captura."
              value={Number((config as any).max_attempts ?? 3)}
              min={1}
              max={10}
              onChange={(v) => setField('max_attempts' as keyof FacialRecognitionConfig, v as any)}
              colorClass="bg-blue-500"
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'enforcement' && (
        <div className="space-y-5">
          <SectionCard
            title="Aplicación"
            subtitle="Cuándo exigir validaciones faciales"
            icon={<ShieldCheck className="h-4 w-4 text-white" />}
            color="bg-rose-500 text-white"
          >
            <Toggle
              label="Exigir validación al crear empleado"
              description="Aplica controles de calidad al subir la foto del empleado."
              checked={Boolean((config as any).enforce_on_employee_create ?? true)}
              onChange={(v) =>
                setField('enforce_on_employee_create' as keyof FacialRecognitionConfig, v as any)
              }
              color="bg-rose-500"
            />
            <Toggle
              label="Exigir validación en marcación"
              description="Aplica validación facial cuando el tenant use esa modalidad."
              checked={Boolean((config as any).enforce_on_attendance ?? false)}
              onChange={(v) => setField('enforce_on_attendance' as keyof FacialRecognitionConfig, v as any)}
              color="bg-rose-500"
            />
            <Toggle
              label="Bloquear captura fuera de parámetros"
              description="Si está activo, la captura se rechaza cuando no cumpla umbrales."
              checked={Boolean((config as any).strict_mode ?? false)}
              onChange={(v) => setField('strict_mode' as keyof FacialRecognitionConfig, v as any)}
              color="bg-rose-500"
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'preview' && <QualityPreview config={config} />}
    </div>
  )
}

export default FacialRecognitionPage
