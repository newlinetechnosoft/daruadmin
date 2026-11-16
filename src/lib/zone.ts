/**
 * Service Zone Definition for Butwal, Tilottama & Bhairahawa (Rupandehi, Nepal).
 * Everything outside this polygon is masked, and map navigation is locked to this area.
 */

/**
 * Service zone boundary polygon: [latitude, longitude] pairs.
 * The ring is closed (first point equals last point).
 */
export const ZONE_POLYGON: [number, number][] = [
  [27.737863, 83.449350],
  [27.694003, 83.440853],
  [27.684320, 83.385857],
  [27.642685, 83.399403],
  [27.514694, 83.391810],
  [27.505727, 83.457240],
  [27.539910, 83.527641],
  [27.626022, 83.515860],
  [27.661291, 83.510019],
  [27.684336, 83.525084],
  [27.706826, 83.502407],
  [27.737863, 83.449350],
]

/**
 * Inverted mask outer world ring covering the entire globe:
 * Used as the outer ring with ZONE_POLYGON as a hole.
 */
export const WORLD_MASK_RING: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
]

/**
 * Default zone configuration for easy tweaking.
 */
export const ZONE_CONFIG = {
  name: 'Butwal - Tilottama - Bhairahawa Service Zone',
  padding: 0.05,
  maxBoundsViscosity: 1.0,
  maxZoom: 19,
  maskColor: 'var(--background, #09090b)',
  maskOpacity: 1.0,
  maskPaneName: 'mask',
  maskPaneZIndex: 450,
  outlineColor: '#f59e0b',
  outlineWeight: 2,
  outsideWarningMessage: 'This location is outside our service area.',
}

/**
 * Pre-computed bounding box for the zone polygon:
 * Southwest: [27.505727, 83.385857]
 * Northeast: [27.737863, 83.527641]
 */
export const ZONE_BOUNDS: [[number, number], [number, number]] = [
  [27.505727, 83.385857],
  [27.737863, 83.527641],
]

/**
 * Computes bounding box extremes for the polygon.
 */
export function getZoneBBox(): {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
} {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const [lat, lng] of ZONE_POLYGON) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Returns the geographic center of the service zone polygon.
 */
export function getZoneCenter(): [number, number] {
  const bbox = getZoneBBox()
  return [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLng + bbox.maxLng) / 2]
}

/**
 * Ray-casting point-in-polygon algorithm to check if a point [lat, lng]
 * falls strictly inside the service zone polygon.
 *
 * Safe for both SSR and client execution without Leaflet or Turf dependencies.
 */
export function isInsideZone(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false
  }

  let inside = false
  const vs = ZONE_POLYGON

  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const yi = vs[i][0]
    const xi = vs[i][1]
    const yj = vs[j][0]
    const xj = vs[j][1]

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) {
      inside = !inside
    }
  }

  return inside
}
