import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import kinks from '@turf/kinks'
import type { GeoJSONPolygon } from '#/db/schema/zones'
import { isInsideZone as isInsideHardcodedZone } from './zone'

/**
 * -----------------------------------------------------------------------------
 * COORDINATE ORDER CONVENTIONS & UTILITIES
 * -----------------------------------------------------------------------------
 * - GeoJSON and Turf standards strictly require [longitude, latitude] ([lng, lat]) order.
 * - Leaflet maps and markers strictly require [latitude, longitude] ([lat, lng]) order.
 *
 * All transformations between Leaflet and GeoJSON coordinate formats in the system
 * must route through these dedicated converter functions.
 * -----------------------------------------------------------------------------
 */

/**
 * Convert a Leaflet [latitude, longitude] coordinate to GeoJSON [longitude, latitude].
 */
export function leafletToGeoJsonCoord(coord: [number, number]): [number, number] {
  return [coord[1], coord[0]]
}

/**
 * Convert a GeoJSON [longitude, latitude] coordinate to Leaflet [latitude, longitude].
 */
export function geoJsonToLeafletCoord(coord: [number, number]): [number, number] {
  return [coord[1], coord[0]]
}

/**
 * Convert a Leaflet ring of [lat, lng] coordinates to a GeoJSON ring of [lng, lat].
 */
export function leafletRingToGeoJson(
  ring: [number, number][],
): [number, number][] {
  return ring.map(([lat, lng]) => [lng, lat])
}

/**
 * Convert a GeoJSON ring of [lng, lat] coordinates to a Leaflet ring of [lat, lng].
 */
export function geoJsonRingToLeaflet(
  ring: [number, number][],
): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng])
}

/**
 * GeoJSON Feature representations for Service Zones.
 */
export interface ServiceZoneFeature {
  type: 'Feature'
  id: string
  geometry: GeoJSONPolygon
  properties: {
    id: string
    name: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    vertexCount: number
  }
}

export interface ServiceZoneFeatureCollection {
  type: 'FeatureCollection'
  features: ServiceZoneFeature[]
}

export interface ZoneGeometryValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates a GeoJSON Polygon for service zones:
 * - Must have type 'Polygon'
 * - Outer ring must have at least 4 points (triangle + closing point)
 * - First point must equal last point (closed loop)
 * - Latitude must be [-90, 90], Longitude must be [-180, 180]
 * - Maximum vertex count check (up to 1,000 vertices)
 * - No self-intersecting edges (verified with Turf kinks)
 */
export function validateZonePolygon(
  polygon: unknown,
): ZoneGeometryValidationResult {
  if (!polygon || typeof polygon !== 'object') {
    return { valid: false, error: 'Polygon geometry object is required' }
  }

  const poly = polygon as Record<string, unknown>
  if (poly.type !== 'Polygon') {
    return { valid: false, error: 'Geometry type must be "Polygon"' }
  }

  if (
    !Array.isArray(poly.coordinates) ||
    poly.coordinates.length === 0 ||
    !Array.isArray(poly.coordinates[0])
  ) {
    return {
      valid: false,
      error: 'Polygon must contain at least one outer ring array',
    }
  }

  const outerRing = poly.coordinates[0] as [number, number][]

  if (outerRing.length < 4) {
    return {
      valid: false,
      error: `Polygon ring must contain at least 4 coordinates (received ${outerRing.length}). At least 3 unique vertices plus the closing vertex are required.`,
    }
  }

  if (outerRing.length > 1000) {
    return {
      valid: false,
      error: `Polygon vertex count exceeds maximum limit of 1,000 (received ${outerRing.length}).`,
    }
  }

  // Verify closed ring: first point equals last point
  const first = outerRing[0]
  const last = outerRing[outerRing.length - 1]

  const isClosed =
    Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9

  if (!isClosed) {
    return {
      valid: false,
      error:
        'Polygon outer ring must be closed: the first point must equal the last point.',
    }
  }

  // Verify coordinates are valid numbers in ranges
  for (let i = 0; i < outerRing.length; i++) {
    const pt = outerRing[i]
    if (
      !Array.isArray(pt) ||
      typeof pt[0] !== 'number' ||
      typeof pt[1] !== 'number' ||
      Number.isNaN(pt[0]) ||
      Number.isNaN(pt[1])
    ) {
      return {
        valid: false,
        error: `Coordinate at index ${i} is not a valid [lng, lat] numerical pair.`,
      }
    }

    const [lng, lat] = pt
    if (lng < -180 || lng > 180) {
      return {
        valid: false,
        error: `Longitude ${lng} at index ${i} is outside valid range [-180, 180].`,
      }
    }
    if (lat < -90 || lat > 90) {
      return {
        valid: false,
        error: `Latitude ${lat} at index ${i} is outside valid range [-90, 90].`,
      }
    }
  }

  // Verify no self-intersection using Turf kinks
  try {
    const geojsonFeature = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: poly.coordinates,
      },
    }
    const selfIntersections = kinks(geojsonFeature)
    if (selfIntersections.features.length > 0) {
      return {
        valid: false,
        error: `Polygon contains ${selfIntersections.features.length} self-intersecting edge(s). Polygon boundary edges cannot cross each other.`,
      }
    }
  } catch (err: unknown) {
    return {
      valid: false,
      error: `Failed to compute polygon intersection check: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return { valid: true }
}

/**
 * Computes bounding box extremes [minLat, minLng] and [maxLat, maxLng]
 * across one or more Leaflet rings ([lat, lng][]).
 */
export function computeMultiRingBounds(
  rings: [number, number][][],
): [[number, number], [number, number]] {
  if (rings.length === 0 || rings[0].length === 0) {
    // Fallback to default Butwal zone
    return [
      [27.505727, 83.385857],
      [27.737863, 83.527641],
    ]
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const ring of rings) {
    for (const [lat, lng] of ring) {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLng)
  ) {
    return [
      [27.505727, 83.385857],
      [27.737863, 83.527641],
    ]
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}

/**
 * Check if a coordinate [lat, lng] falls within any of the provided active GeoJSON zones.
 * If zones list is empty or undefined, falls back to the hardcoded default zone.
 */
export function isPointInsideAnyZone(
  lat: number | null | undefined,
  lng: number | null | undefined,
  activeZones?: Array<{ polygon: GeoJSONPolygon; isActive?: boolean }> | null,
): boolean {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false
  }

  const validZones = (activeZones || []).filter(
    (z) => z.isActive !== false && z.polygon.coordinates.length > 0,
  )

  if (validZones.length === 0) {
    // Fallback to constant ZONE_POLYGON
    return isInsideHardcodedZone(lat, lng)
  }

  const pointGeoJson = {
    type: 'Point' as const,
    coordinates: [lng, lat] as [number, number], // Turf requires [lng, lat]
  }

  for (const zone of validZones) {
    try {
      const polygonFeature = {
        type: 'Feature' as const,
        properties: {},
        geometry: zone.polygon,
      }
      if (booleanPointInPolygon(pointGeoJson, polygonFeature)) {
        return true
      }
    } catch {
      // Continue checking next zone if one has invalid geometry
    }
  }

  return false
}
