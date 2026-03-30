import type { GeoLocation } from '../types'

function toRad(v: number) {
  return (v * Math.PI) / 180
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(a))
}

export function isAccuracyAcceptable(accuracy: number, maxAccuracy: number) {
  return accuracy > 0 && accuracy <= maxAccuracy
}

export function validateGeofence(
  latitude: number,
  longitude: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number
) {
  const distance = Math.round(
    haversineMeters(latitude, longitude, centerLat, centerLng)
  )

  return {
    distance,
    status: distance <= radiusMeters ? 'inside' : 'outside',
  } as const
}

export async function getCurrentPosition(): Promise<GeoLocation> {
  if (!('geolocation' in navigator)) {
    throw new Error('Este navegador no soporta geolocalización.')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Permiso de GPS denegado.'))
          return
        }
        if (err.code === err.TIMEOUT) {
          reject(new Error('Tiempo de espera agotado al obtener GPS.'))
          return
        }
        reject(new Error('No se pudo obtener la ubicación.'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  })
}