import type { FacialRecognitionConfig } from '@/pages/employees/employeeSchemas'

export type QualityMetrics = { brightness: number; contrast: number; sharpness: number }

export async function computeImageMetrics(file: File): Promise<QualityMetrics> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas no disponible')

  const maxW = 640
  const scale = Math.min(1, maxW / img.width)
  canvas.width = Math.floor(img.width * scale)
  canvas.height = Math.floor(img.height * scale)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const n = canvas.width * canvas.height
  const lum = new Float32Array(n)

  let sum = 0
  let sumSq = 0

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lum[p] = y
    sum += y
    sumSq += y * y
  }

  const mean = sum / n
  const variance = Math.max(0, sumSq / n - mean * mean)
  const std = Math.sqrt(variance)

  let gradSum = 0
  const w = canvas.width
  const h = canvas.height
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const gx = lum[idx + 1] - lum[idx - 1]
      const gy = lum[idx + w] - lum[idx - w]
      gradSum += Math.abs(gx) + Math.abs(gy)
    }
  }

  const sharpness = Math.min(100, (gradSum / n / 1.5) * 100)

  return {
    brightness: mean,
    contrast: (std / 128) * 100,
    sharpness
  }
}

export function validateMetrics(m: QualityMetrics, cfg: FacialRecognitionConfig) {
  const issues: string[] = []
  if (m.brightness < cfg.min_brightness) issues.push(`Imagen muy oscura (brillo ${m.brightness.toFixed(0)} < ${cfg.min_brightness})`)
  if (m.brightness > cfg.max_brightness) issues.push(`Imagen muy brillante (brillo ${m.brightness.toFixed(0)} > ${cfg.max_brightness})`)
  if (m.contrast < cfg.min_contrast) issues.push(`Bajo contraste (${m.contrast.toFixed(0)} < ${cfg.min_contrast})`)
  if (m.sharpness < cfg.min_sharpness) issues.push(`Imagen borrosa (${m.sharpness.toFixed(0)} < ${cfg.min_sharpness})`)
  return { ok: issues.length === 0, issues }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar imagen')) }
    img.src = url
  })
}
