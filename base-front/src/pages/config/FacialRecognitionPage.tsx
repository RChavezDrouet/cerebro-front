// src/pages/config/FacialRecognitionPage.tsx
// v4.5.0 - Módulo de Reconocimiento Facial
// Incluye: Configuración de calidad de foto, parámetros de captura y opciones avanzadas

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Sliders, ShieldCheck, Eye, Sun, Contrast, Focus,
  Maximize2, RotateCcw, Save, Loader2, CheckCircle, AlertTriangle,
  RefreshCw, Info
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { resolveTenantId } from '@/lib/tenant';
import type { FacialRecognitionConfig } from '@/pages/employees/employeeSchemas';
import { FACIAL_CONFIG_DEFAULTS, facialRecognitionConfigSchema } from '@/pages/employees/employeeSchemas';

// ─────────────────────────────────────────
// Componentes internos
// ─────────────────────────────────────────
const SliderField: React.FC<{
  label: string;
  description?: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  colorClass?: string;
}> = ({ label, description, icon, value, min, max, step = 1, unit = '', onChange, colorClass = 'bg-blue-500' }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-sm font-bold text-blue-600 min-w-[4rem] text-right">
          {value}{unit}
        </span>
      </div>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      <div className="relative h-2 bg-gray-200 rounded-full">
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
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}> = ({ label, description, checked, onChange, color = 'bg-blue-500' }) => (
  <label className="flex items-start gap-4 cursor-pointer group">
    <div className="flex-shrink-0 mt-0.5">
      <div
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${
          checked ? color : 'bg-gray-300'
        }`}
      >
        <div
          className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
  </label>
);

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, color, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-3 ${color}`}>
      <div className="p-2 bg-white/30 rounded-lg">{icon}</div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6 space-y-6">{children}</div>
  </div>
);

// ─────────────────────────────────────────
// Vista previa de calidad
// ─────────────────────────────────────────
const QualityPreview: React.FC<{ config: FacialRecognitionConfig }> = ({ config }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [metrics, setMetrics] = useState<{ brightness: number; contrast: number; sharpness: number } | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        // Actualizar métricas cada 500ms
        intervalRef.current = window.setInterval(() => analyzeFrame(), 500);
      }
    } catch {
      alert('No se pudo acceder a la cámara para la vista previa.');
    }
  };

  const stopPreview = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsStreaming(false);
    setMetrics(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const analyzeFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let totalBrightness = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    const brightness = Math.round(totalBrightness / pixelCount);
    let variance = 0;
    for (let i = 0; i < data.length; i += 4) {
      const pb = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      variance += Math.pow(pb - brightness, 2);
    }
    const contrast = Math.round(Math.sqrt(variance / pixelCount) * 100 / 128);
    setMetrics({ brightness, contrast, sharpness: Math.min(100, Math.round(contrast * 1.2)) });
  };

  useEffect(() => () => stopPreview(), []);

  const getStatus = (value: number, min: number, max?: number) => {
    if (value < min) return 'red';
    if (max && value > max) return 'red';
    return 'green';
  };

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <p className="text-white text-sm font-medium">Vista previa en tiempo real</p>
        <button
          onClick={isStreaming ? stopPreview : startPreview}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
            isStreaming ? 'bg-red-500 text-white' : 'bg-white text-gray-900'
          }`}
        >
          {isStreaming ? 'Detener' : 'Iniciar cámara'}
        </button>
      </div>

      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-12 h-12 text-gray-600" />
          </div>
        )}
        {/* Overlay de guía */}
        {isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full border-2 border-white/50 opacity-60"
              style={{ width: '55%', paddingTop: '55%' }} />
          </div>
        )}
      </div>

      {/* Métricas en tiempo real */}
      {metrics && (
        <div className="p-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Brillo', value: metrics.brightness, min: config.min_brightness, max: config.max_brightness, unit: '' },
            { label: 'Contraste', value: metrics.contrast, min: config.min_contrast, unit: '%' },
            { label: 'Nitidez', value: metrics.sharpness, min: config.min_sharpness, unit: '%' },
          ].map(({ label, value, min, max, unit }) => {
            const status = getStatus(value, min, max);
            return (
              <div key={label} className="bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-lg font-bold ${status === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                  {value}{unit}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {status === 'green' ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-xs ${status === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                    {status === 'green' ? 'OK' : `Mín: ${min}${unit}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────
export const FacialRecognitionPage: React.FC = () => {
  const [config, setConfig] = useState<FacialRecognitionConfig>(FACIAL_CONFIG_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'quality' | 'capture' | 'enforcement' | 'preview'>('quality');

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant')
      const { data } = await supabase
        .schema('attendance')
        .from('facial_recognition_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) setConfig({ ...FACIAL_CONFIG_DEFAULTS, ...(data as Partial<FacialRecognitionConfig>) } as FacialRecognitionConfig);
    } catch (err) {
      console.error('Error cargando config facial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const setField = <K extends keyof FacialRecognitionConfig>(key: K, value: FacialRecognitionConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setConfig(FACIAL_CONFIG_DEFAULTS);
  };

  const handleSave = async () => {
    const parsed = facialRecognitionConfigSchema.safeParse(config);
    if (!parsed.success) {
      alert('Hay errores en la configuración: ' + parsed.error.issues.map((i) => i.message).join(', '));
      return;
    }
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const tenantId = await resolveTenantId(user.id)
      if (!tenantId) throw new Error('No tenant')
      const normalizedThreshold = Number(parsed.data.match_threshold_percent)
      const payload = {
        ...parsed.data,
        tenant_id: tenantId,
        match_threshold_percent: normalizedThreshold,
        face_threshold: normalizedThreshold,
        threshold_pct: normalizedThreshold,
        similarity_threshold_pct: normalizedThreshold,
      };
      const table = supabase.schema('attendance').from('facial_recognition_config')
      const result = config.id
        ? await table.update(payload).eq('id', config.id)
        : await table.insert(payload)
      if (result.error) throw result.error
      setSaveStatus('success');
      await loadConfig();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error guardando config:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'quality', label: 'Calidad de Foto', icon: <Sliders className="w-4 h-4" /> },
    { id: 'capture', label: 'Captura', icon: <Camera className="w-4 h-4" /> },
    { id: 'enforcement', label: 'Aplicación', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'preview', label: 'Vista Previa', icon: <Eye className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Camera className="w-7 h-7 text-blue-600" />
            Reconocimiento Facial
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configura los parámetros de calidad de fotografía y reconocimiento facial para tu empresa.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Restablecer
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* Feedback de guardado */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm border border-green-200">
          <CheckCircle className="w-4 h-4" />
          Configuración guardada exitosamente
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-200">
          <AlertTriangle className="w-4 h-4" />
          Error al guardar. Intenta de nuevo.
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB: CALIDAD DE FOTO
      ══════════════════════════════════ */}
      {activeTab === 'quality' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Estos parámetros definen cuándo una fotografía es aceptable. Se aplican tanto al
              registrar empleados como al marcar asistencia (según configuración en "Aplicación").
            </p>
          </div>

          <SectionCard
            title="Brillo"
            subtitle="Nivel de luminosidad de la imagen"
            icon={<Sun className="w-4 h-4 text-white" />}
            color="bg-amber-400 text-white"
          >
            <SliderField
              label="Brillo mínimo"
              description="Imágenes más oscuras que este valor serán rechazadas"
              icon={<Sun className="w-4 h-4" />}
              value={config.min_brightness}
              min={0}
              max={200}
              onChange={(v) => setField('min_brightness', v)}
              colorClass="bg-amber-400"
            />
            <SliderField
              label="Brillo máximo"
              description="Imágenes sobreexpuestas (más brillantes) serán rechazadas"
              icon={<Sun className="w-4 h-4" />}
              value={config.max_brightness}
              min={100}
              max={255}
              onChange={(v) => setField('max_brightness', v)}
              colorClass="bg-orange-400"
            />
          </SectionCard>

          <SectionCard
            title="Contraste"
            subtitle="Diferencia entre zonas claras y oscuras"
            icon={<Contrast className="w-4 h-4 text-white" />}
            color="bg-purple-500 text-white"
          >
            <SliderField
              label="Contraste mínimo"
              description="Fotos con bajo contraste (apagadas o sin definición) serán rechazadas"
              icon={<Contrast className="w-4 h-4" />}
              value={config.min_contrast}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => setField('min_contrast', v)}
              colorClass="bg-purple-500"
            />
          </SectionCard>

          <SectionCard
            title="Nitidez"
            subtitle="Claridad y definición de la imagen"
            icon={<Focus className="w-4 h-4 text-white" />}
            color="bg-green-500 text-white"
          >
            <SliderField
              label="Nitidez mínima"
              description="Fotos borrosas o fuera de foco serán rechazadas"
              icon={<Focus className="w-4 h-4" />}
              value={config.min_sharpness}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => setField('min_sharpness', v)}
              colorClass="bg-green-500"
            />
          </SectionCard>

          <SectionCard
            title="Geometría del Rostro"
            subtitle="Tamaño y orientación"
            icon={<Maximize2 className="w-4 h-4 text-white" />}
            color="bg-blue-500 text-white"
          >
            <div className="grid grid-cols-2 gap-8">
              <SliderField
                label="Ancho mínimo del rostro"
                description="Píxeles mínimos de ancho"
                value={config.min_face_width_px}
                min={50}
                max={400}
                unit="px"
                onChange={(v) => setField('min_face_width_px', v)}
              />
              <SliderField
                label="Alto mínimo del rostro"
                description="Píxeles mínimos de alto"
                value={config.min_face_height_px}
                min={50}
                max={400}
                unit="px"
                onChange={(v) => setField('min_face_height_px', v)}
              />
            </div>
            <SliderField
              label="Ángulo máximo de inclinación"
              description="Inclinación de cabeza permitida. 0° = completamente recto."
              value={config.max_tilt_angle}
              min={0}
              max={45}
              unit="°"
              onChange={(v) => setField('max_tilt_angle', v)}
            />
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: CAPTURA
      ══════════════════════════════════ */}
      {activeTab === 'capture' && (
        <div className="space-y-5">
          <SectionCard
            title="Parámetros de Captura"
            subtitle="Controla cómo se realizan las capturas fotográficas"
            icon={<Camera className="w-4 h-4 text-white" />}
            color="bg-blue-600 text-white"
          >
            <SliderField
              label="Número de fotos a capturar"
              description="El sistema tomará este número de fotografías y usará la de mejor calidad"
              value={config.capture_count}
              min={1}
              max={10}
              onChange={(v) => setField('capture_count', v)}
            />
            <SliderField
              label="Intervalo entre capturas"
              description="Segundos de espera entre cada fotografía automática"
              value={config.capture_interval_sec}
              min={1}
              max={10}
              unit="s"
              onChange={(v) => setField('capture_interval_sec', v)}
            />
          </SectionCard>

          {/* Resumen de configuración */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Resumen de configuración actual</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Brillo mínimo', value: `${config.min_brightness}` },
                { label: 'Brillo máximo', value: `${config.max_brightness}` },
                { label: 'Contraste mínimo', value: `${config.min_contrast}%` },
                { label: 'Nitidez mínima', value: `${config.min_sharpness}%` },
                { label: 'Tamaño mínimo', value: `${config.min_face_width_px}×${config.min_face_height_px}px` },
                { label: 'Ángulo máximo', value: `${config.max_tilt_angle}°` },
                { label: 'Fotos por captura', value: `${config.capture_count}` },
                { label: 'Intervalo', value: `${config.capture_interval_sec}s` },
                { label: 'Umbral facial', value: `${config.match_threshold_percent}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: APLICACIÓN / ENFORCEMENT
      ══════════════════════════════════ */}
      {activeTab === 'enforcement' && (
        <div className="space-y-5">
          <SectionCard
            title="¿Cuándo aplicar la validación?"
            subtitle="Define en qué momentos se verificará la calidad fotográfica"
            icon={<ShieldCheck className="w-4 h-4 text-white" />}
            color="bg-green-600 text-white"
          >
            <Toggle
              label="Validar al registrar empleado"
              description="La foto capturada durante el registro de un empleado debe cumplir los estándares de calidad para poder guardarse."
              checked={config.enforce_on_enrollment}
              onChange={(v) => setField('enforce_on_enrollment', v)}
              color="bg-green-500"
            />
            <div className="border-t border-gray-100" />
            <Toggle
              label="Validar al marcar asistencia"
              description="Las fotos tomadas durante el marcaje de asistencia deben cumplir los estándares de calidad."
              checked={config.enforce_on_attendance}
              onChange={(v) => setField('enforce_on_attendance', v)}
              color="bg-green-500"
            />
          </SectionCard>


          <SectionCard
            title="Umbral de coincidencia facial"
            subtitle="Tolerancia del reconocimiento selfie vs foto oficial"
            icon={<ShieldCheck className="w-4 h-4 text-white" />}
            color="bg-emerald-600 text-white"
          >
            <SliderField
              label="Umbral de tolerancia"
              description="Mientras más alto sea el porcentaje, más estricta será la comparación facial. Ejemplo recomendado: 75% a 85%."
              value={config.match_threshold_percent}
              min={50}
              max={100}
              unit="%"
              onChange={(v) => setField('match_threshold_percent', v)}
              colorClass="bg-emerald-500"
            />
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
              Este valor se guarda por tenant y se reutiliza como referencia para la verificación facial en PWA y servicios asociados.
            </div>
          </SectionCard>

          <SectionCard
            title="Funciones Avanzadas"
            subtitle="Características experimentales de reconocimiento"
            icon={<Eye className="w-4 h-4 text-white" />}
            color="bg-indigo-600 text-white"
          >
            <Toggle
              label="Detección de vivacidad (Liveness)"
              description="Detecta si la persona está físicamente presente vs. una foto impresa o en pantalla. Requiere buena iluminación y conexión estable."
              checked={config.require_liveness}
              onChange={(v) => setField('require_liveness', v)}
              color="bg-indigo-500"
            />
            {config.require_liveness && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-700 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                La detección de vivacidad está activada. Los empleados deberán seguir las instrucciones en pantalla
                (parpadear, girar la cabeza) para confirmar que son personas reales.
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: VISTA PREVIA
      ══════════════════════════════════ */}
      {activeTab === 'preview' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Usa esta sección para probar tu configuración en tiempo real. Las métricas mostradas
              usarán los parámetros guardados. Activa la cámara y verifica que tu imagen cumpla los requisitos.
            </p>
          </div>
          <QualityPreview config={config} />
        </div>
      )}

      {/* ── Footer de guardar ── */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-semibold text-sm shadow-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
          ) : (
            <><Save className="w-4 h-4" /> Guardar configuración</>
          )}
        </button>
      </div>
    </div>
  );
};

export default FacialRecognitionPage;
