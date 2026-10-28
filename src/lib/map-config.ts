export {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  type GeoPoint,
  calculateHaversineDistanceKm,
  formatDistanceKm,
  isPointWithinRadius,
  sortLocationsByDistance,
  getDealerWhatsAppConfirmationUrl,
} from './geo'

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
