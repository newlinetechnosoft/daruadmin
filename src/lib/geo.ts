/**
 * Geospatial utilities for distance calculations, proximity sorting,
 * zone verification, and courier/dealer routing in Nepal (defaulting to Butwal/Rupandehi).
 */

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Service area center coordinates (Traffic Chowk, Butwal, Rupandehi).
 */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7006, 83.4484]
export const DEFAULT_MAP_ZOOM = 14

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (
    Number.isNaN(lat1) ||
    Number.isNaN(lng1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lng2)
  ) {
    return 0
  }

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
 * Human-readable distance format (e.g., "650 m", "2.4 km").
 */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) {
    return 'Unknown distance'
  }
  if (km < 1) {
    const meters = Math.round(km * 1000)
    return `${meters} m`
  }
  return `${km.toFixed(1)} km`
}

/**
 * Checks if a coordinate is within a circular radius of a center point.
 */
export function isPointWithinRadius(
  center: GeoPoint,
  point: GeoPoint,
  radiusKm: number,
): boolean {
  const dist = calculateHaversineDistanceKm(
    center.lat,
    center.lng,
    point.lat,
    point.lng,
  )
  return dist <= radiusKm
}

/**
 * Sorts arbitrary entities by Haversine distance from an origin point.
 */
export function sortLocationsByDistance<
  T extends { lat?: number | string | null; lng?: number | string | null },
>(origin: GeoPoint, locations: T[]): (T & { distanceKm: number | null })[] {
  return locations
    .map((loc) => {
      const lat = loc.lat != null ? Number(loc.lat) : null
      const lng = loc.lng != null ? Number(loc.lng) : null
      const distanceKm =
        lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
          ? calculateHaversineDistanceKm(origin.lat, origin.lng, lat, lng)
          : null

      return {
        ...loc,
        distanceKm,
      }
    })
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })
}

/**
 * Generates a WhatsApp deep-link URL for dealer order dispatch / stock acceptance.
 */
export function getDealerWhatsAppConfirmationUrl(options: {
  dealerName: string
  dealerPhone: string
  orderNumber: string
  items: { name: string; qty: number; variantName?: string }[]
  pickupAddress?: string
}): string {
  const cleanPhone = options.dealerPhone.replace(/[^0-9]/g, '')
  const itemListText = options.items
    .map(
      (it) =>
        `• ${it.qty}x ${it.name}${it.variantName ? ` (${it.variantName})` : ''}`,
    )
    .join('\n')

  const message = [
    `Namaste ${options.dealerName},`,
    `Mezmani has assigned Order #${options.orderNumber} to your store for pickup:`,
    '',
    itemListText,
    '',
    `Please confirm if this order is ready for courier pickup:`,
    `Reply "YES" to confirm or "NO" if unavailable.`,
  ].join('\n')

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
