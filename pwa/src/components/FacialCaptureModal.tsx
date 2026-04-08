// src/components/FacialCaptureModal.tsx
// Modal para captura de fotografía facial con validación de calidad

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, CheckCircle, AlertTriangle, RefreshCw, ZoomIn } from 'lucide-react';
import type { FacialRecognitionConfig } from '@/pages/employees/employeeSchemas';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface PhotoQualityResult {
  passed: boolean;
  brightness: number;
  contrast: number;
  sharpness: number;
  issues: string[];
}

interface FacialCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string, url?: string) => void;
  config: FacialRecognitionConfig;
  existingPhotoUrl?: string | null;
}

// ─────────────────────────────────────────
// Función: Análisis de calidad de imagen
// ─────────────────────────────────────────
function analyzeImageQuality(
  canvas: HTMLCanvasElement,
  config: FacialRecognitionConfig
): PhotoQualityResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { passed: false, brightness: 0, contrast: 0, sharpness: 0, issues: ['Error al analizar imagen'] };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const issues: string[] = [];

  // Calcular brillo promedio (canal gris)
  let totalBrightness = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  const brightness = Math.round(totalBrightness / pixelCount);

  // Calcular contraste (desviación estándar del brillo)
  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pixelBrightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    variance += Math.pow(pixelBrightness - brightness, 2);
  }
  const contrast = Math.round(Math.sqrt(variance / pixelCount) * 100 / 128);

  // Calcular nitidez (Laplacian variance simplificado)
  let sharpnessSum = 0;
  const w = canvas.width;
  const h = canvas.height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const idxUp = ((y - 1) * w + x) * 4;
      const idxDown = ((y + 1) * w + x) * 4;
      const idxLeft = (y * w + (x - 1)) * 4;
      const idxRight = (y * w + (x + 1)) * 4;

      const lap = Math.abs(
        4 * data[idx] - data[idxUp] - data[idxDown] - data[idxLeft] - data[idxRight]
      );
      sharpnessSum += lap;
    }
  }
  const sharpness = Math.min(100, Math.round(sharpnessSum / (w * h) * 5));

  // Validar contra configuración
  if (brightness < config.min_brightness) {
    issues.push(`Imagen muy oscura (brillo: ${brightness}, mínimo: ${config.min_brightness})`);
  }
  if (brightness > config.max_brightness) {
    issues.push(`Imagen muy clara/sobreexpuesta (brillo: ${brightness}, máximo: ${config.max_brightness})`);
  }
  if (contrast < config.min_contrast) {
    issues.push(`Contraste insuficiente (${contrast}%, mínimo: ${config.min_contrast}%)`);
  }
  if (sharpness < config.min_sharpness) {
    issues.push(`Imagen borrosa (nitidez: ${sharpness}%, mínimo: ${config.min_sharpness}%)`);
  }

  return {
    passed: issues.length === 0,
    brightness,
    contrast,
    sharpness,
    issues,
  };
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export const FacialCaptureModal: React.FC<FacialCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  config,
  existingPhotoUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<'preview' | 'camera' | 'review'>('preview');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<PhotoQualityResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Iniciar cámara
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStep('camera');
    } catch (err) {
      setCameraError(
        'No se pudo acceder a la cámara. Verifica los permisos del navegador.'
      );
      console.error('Camera error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Capturar foto
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Voltear horizontalmente (efecto espejo → foto natural)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(base64);

    const result = analyzeImageQuality(canvas, config);
    setQuality(result);

    stopCamera();
    setStep('review');
  }, [config, stopCamera]);

  // Reintentar
  const retake = useCallback(() => {
    setCapturedImage(null);
    setQuality(null);
    setStep('camera');
    startCamera();
  }, [startCamera]);

  // Confirmar foto
  const confirmPhoto = useCallback(() => {
    if (!capturedImage) return;
    onCapture(capturedImage);
    onClose();
  }, [capturedImage, onCapture, onClose]);

  // Limpiar al cerrar
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStep('preview');
      setCapturedImage(null);
      setQuality(null);
      setCameraError(null);
    }
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              Captura de Fotografía Facial
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div className="text-center space-y-4">
              {existingPhotoUrl ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Fotografía actual del empleado:</p>
                  <img
                    src={existingPhotoUrl}
                    alt="Foto actual"
                    className="w-48 h-48 rounded-full object-cover mx-auto border-4 border-blue-100"
                  />
                  <p className="text-sm text-gray-500">
                    Puedes tomar una nueva foto o mantener la actual.
                  </p>
                </div>
              ) : (
                <div className="w-48 h-48 rounded-full bg-gray-100 flex items-center justify-center mx-auto border-4 border-dashed border-gray-300">
                  <Camera className="w-16 h-16 text-gray-300" />
                </div>
              )}

              {/* Requisitos de calidad */}
              <div className="bg-blue-50 rounded-xl p-4 text-left">
                <p className="text-xs font-semibold text-blue-700 mb-2">Requisitos de calidad:</p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Buena iluminación, evita contraluz</li>
                  <li>• Mira directamente a la cámara</li>
                  <li>• Ángulo máximo permitido: {config.max_tilt_angle}°</li>
                  <li>• Sin lentes de sol ni elementos que cubran el rostro</li>
                  <li>• Nitidez mínima requerida: {config.min_sharpness}%</li>
                </ul>
              </div>

              {cameraError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {cameraError}
                </div>
              )}

              <div className="flex gap-3">
                {existingPhotoUrl && (
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Mantener actual
                  </button>
                )}
                <button
                  onClick={startCamera}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {isLoading ? 'Iniciando...' : 'Abrir cámara'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: CAMERA ── */}
          {step === 'camera' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full"
                  style={{ transform: 'scaleX(-1)' }}
                  muted
                  playsInline
                />
                {/* Guía de encuadre */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="rounded-full border-4 border-white/60 opacity-70"
                    style={{ width: '60%', paddingTop: '60%' }}
                  />
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center text-white/80 text-xs">
                  Centra tu rostro dentro del círculo
                </div>
              </div>

              {/* Canvas oculto para captura */}
              <canvas ref={canvasRef} className="hidden" />

              <div className="flex gap-3">
                <button
                  onClick={() => { stopCamera(); setStep('preview'); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capturar foto
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: REVIEW ── */}
          {step === 'review' && capturedImage && quality && (
            <div className="space-y-4">
              {/* Foto capturada */}
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full rounded-xl object-cover max-h-64"
                />
                {quality.passed ? (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Calidad OK
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Baja calidad
                  </div>
                )}
              </div>

              {/* Métricas de calidad */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Brillo', value: quality.brightness, max: 255, unit: '' },
                  { label: 'Contraste', value: quality.contrast, max: 100, unit: '%' },
                  { label: 'Nitidez', value: quality.sharpness, max: 100, unit: '%' },
                ].map(({ label, value, max, unit }) => {
                  const pct = (value / max) * 100;
                  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500';
                  return (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="text-lg font-bold text-gray-800">
                        {value}{unit}
                      </p>
                      <div className="h-1.5 bg-gray-200 rounded-full mt-2">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Problemas detectados */}
              {quality.issues.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-semibold text-red-700">Problemas detectados:</p>
                  {quality.issues.map((issue, i) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {issue}
                    </p>
                  ))}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Retomar
                </button>
                <button
                  onClick={confirmPhoto}
                  disabled={!quality.passed && config.enforce_on_enrollment}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {quality.passed ? 'Confirmar foto' : 'Calidad insuficiente'}
                </button>
              </div>

              {!quality.passed && !config.enforce_on_enrollment && (
                <p className="text-xs text-center text-yellow-600">
                  ⚠️ La foto no cumple los estándares de calidad. Puedes guardarla igualmente.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
