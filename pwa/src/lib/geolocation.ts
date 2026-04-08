// =============================================
// HRCloud Attendance PWA - Geolocation Utilities
// =============================================
// Incluye: captura GPS, cálculo de distancia Haversine,
// validación de geocerca y formateo de coordenadas.

import type { GeoLocation, GeofenceStatus } from '../types'

/**
 * Captura la ubicación GPS actual con alta precisión.
 * Retorna una Promise con las coordenadas o lanza error.
 * 
 * @param timeout - Tiempo máximo de espera en ms (default: 15000)
 * @param maxAge - Edad máxima de la cache GPS en ms (default: 0 = sin cache)
 */
export const getCurrentPosition = (
  timeout = 15000,
  maxAge = 0
): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada por este navegador'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Permiso de ubicación denegado. Activa el GPS en tu dispositivo.'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Ubicación no disponible. Verifica tu conexión GPS.'))
            break
          case error.TIMEOUT:
            reject(new Error('Tiempo de espera agotado obteniendo ubicación.'))
            break
          default:
            reject(new Error('Error desconocido obteniendo ubicación.'))
        }
      },
      {
        enableHighAccuracy: true,
        timeout,
        maximumAge: maxAge,
      }
    )
  })
}

/**
 * Calcula la distancia entre dos puntos GPS usando la fórmula de Haversine.
 * Retorna la distancia en metros.
 * 
 * @param lat1 - Latitud punto 1
 * @param lon1 - Longitud punto 1
 * @param lat2 - Latitud punto 2
 * @param lon2 - Longitud punto 2
 * @returns Distancia en metros
 */
export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3 // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Valida si la ubicación actual está dentro de la geocerca del empleado.
 * 
 * @param currentLat - Latitud actual
 * @param currentLng - Longitud actual
 * @param fenceLat - Latitud centro geocerca
 * @param fenceLng - Longitud centro geocerca
 * @param fenceRadius - Radio de la geocerca en metros
 * @returns { status, distance } 
 */
export const validateGeofence = (
  currentLat: number,
  currentLng: number,
  fenceLat: number | null,
  fenceLng: number | null,
  fenceRadius: number | null
): { status: GeofenceStatus; distance: number | null } => {
  // Si no hay geocerca configurada, es válido
  if (fenceLat === null || fenceLng === null || fenceRadius === null) {
    return { status: 'no_geofence', distance: null }
  }

  const distance = haversineDistance(currentLat, currentLng, fenceLat, fenceLng)
  const isInside = distance <= fenceRadius

  return {
    status: isInside ? 'inside' : 'outside',
    distance: Math.round(distance),
  }
}

/**
 * Formatea coordenadas a string legible
 */
export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/**
 * Formatea distancia a string con unidades
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * Valida que la precisión GPS sea aceptable
 * @param accuracy - Precisión en metros
 * @param maxAccuracy - Máxima precisión aceptable (default: 50m)
 */
export const isAccuracyAcceptable = (
  accuracy: number,
  maxAccuracy: number = 50
): boolean => {
  return accuracy <= maxAccuracy
}
