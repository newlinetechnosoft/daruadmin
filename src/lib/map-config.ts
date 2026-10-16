/**
 * Default map configuration for delivery location selection.
 * Service area center coordinates (Butwal / Rupandehi).
 */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7006, 83.4484]
export const DEFAULT_MAP_ZOOM = 14

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
}

/**
 * Generates a Google Maps URL using latitude and longitude coordinates if available,
 * falling back to formatted address text.
 */
export function getGoogleMapsUrl(location: {
  lat?: number | string | null
  lng?: number | string | null
  address?: string
  city?: string
}): string {
  const hasCoordinates =
    location.lat != null &&
    location.lng != null &&
    !Number.isNaN(Number(location.lat)) &&
    !Number.isNaN(Number(location.lng))

  if (hasCoordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
  }

  const query = [location.address, location.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
