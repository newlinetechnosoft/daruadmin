/**
 * Default map configuration for delivery location selection.
 * Kathmandu Valley center coordinates.
 */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7172, 85.324]
export const DEFAULT_MAP_ZOOM = 14

export interface GeoPoint {
  lat: number
  lng: number
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
