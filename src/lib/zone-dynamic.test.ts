import { describe, expect, it } from 'bun:test'
import {
  validateZonePolygon,
  isPointInsideAnyZone,
  leafletToGeoJsonCoord,
  geoJsonToLeafletCoord,
  leafletRingToGeoJson,
  geoJsonRingToLeaflet,
  computeMultiRingBounds,
} from './geo-utils'
import type { GeoJSONPolygon } from '#/db/schema/zones'

describe('Dynamic Service Zone Geo Utilities', () => {
  it('converts between Leaflet and GeoJSON coordinate formats', () => {
    const leafletPt: [number, number] = [27.7006, 83.4484] // [lat, lng]
    const geoJsonPt = leafletToGeoJsonCoord(leafletPt)
    expect(geoJsonPt).toEqual([83.4484, 27.7006]) // [lng, lat]

    const roundTrip = geoJsonToLeafletCoord(geoJsonPt)
    expect(roundTrip).toEqual(leafletPt)

    const leafletRing: [number, number][] = [
      [27.7, 83.4],
      [27.8, 83.5],
      [27.7, 83.5],
      [27.7, 83.4],
    ]
    const geoRing = leafletRingToGeoJson(leafletRing)
    expect(geoRing[0]).toEqual([83.4, 27.7])
    expect(geoJsonRingToLeaflet(geoRing)).toEqual(leafletRing)
  })

  it('validates a correct closed GeoJSON polygon without self-intersections', () => {
    const validPolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [83.4, 27.6],
          [83.5, 27.6],
          [83.5, 27.7],
          [83.4, 27.7],
          [83.4, 27.6],
        ],
      ],
    }

    const res = validateZonePolygon(validPolygon)
    expect(res.valid).toBe(true)
    expect(res.error).toBeUndefined()
  })

  it('rejects an unclosed polygon ring', () => {
    const unclosedPolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [83.4, 27.6],
          [83.5, 27.6],
          [83.5, 27.7],
          [83.4, 27.7],
        ],
      ],
    }

    const res = validateZonePolygon(unclosedPolygon)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('closed')
  })

  it('rejects a polygon ring with fewer than 4 points', () => {
    const tooFewPoints: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [83.4, 27.6],
          [83.5, 27.6],
          [83.4, 27.6],
        ],
      ],
    }

    const res = validateZonePolygon(tooFewPoints)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('at least 4 coordinates')
  })

  it('rejects self-intersecting polygon (figure-8 / hourglass)', () => {
    // A figure-8 / hourglass polygon crossing itself:
    // (0,0) -> (2,2) -> (0,2) -> (2,0) -> (0,0)
    const selfIntersectingPolygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [83.4, 27.4],
          [83.6, 27.6],
          [83.4, 27.6],
          [83.6, 27.4],
          [83.4, 27.4],
        ],
      ],
    }

    const res = validateZonePolygon(selfIntersectingPolygon)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('self-intersecting')
  })

  it('rejects out-of-range coordinates', () => {
    const outOfRange: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [190, 27.6],
          [83.5, 27.6],
          [83.5, 27.7],
          [190, 27.6],
        ],
      ],
    }

    const res = validateZonePolygon(outOfRange)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('outside valid range')
  })

  it('checks point-in-polygon across multiple active zones and falls back when empty', () => {
    const activeZone1: { polygon: GeoJSONPolygon; isActive: boolean } = {
      isActive: true,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [83.4, 27.6],
            [83.5, 27.6],
            [83.5, 27.7],
            [83.4, 27.7],
            [83.4, 27.6],
          ],
        ],
      },
    }

    const activeZone2: { polygon: GeoJSONPolygon; isActive: boolean } = {
      isActive: true,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [83.6, 27.8],
            [83.7, 27.8],
            [83.7, 27.9],
            [83.6, 27.9],
            [83.6, 27.8],
          ],
        ],
      },
    }

    const inactiveZone: { polygon: GeoJSONPolygon; isActive: boolean } = {
      isActive: false,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [84.0, 28.0],
            [84.1, 28.0],
            [84.1, 28.1],
            [84.0, 28.1],
            [84.0, 28.0],
          ],
        ],
      },
    }

    const zones = [activeZone1, activeZone2, inactiveZone]

    // Point in zone 1: (lat: 27.65, lng: 83.45)
    expect(isPointInsideAnyZone(27.65, 83.45, zones)).toBe(true)

    // Point in zone 2: (lat: 27.85, lng: 83.65)
    expect(isPointInsideAnyZone(27.85, 83.65, zones)).toBe(true)

    // Point in inactive zone: (lat: 28.05, lng: 84.05) -> should be false
    expect(isPointInsideAnyZone(28.05, 84.05, zones)).toBe(false)

    // Faraway point (Kathmandu: 27.7172, 85.324)
    expect(isPointInsideAnyZone(27.7172, 85.324, zones)).toBe(false)

    // When zones is empty, falls back to default ZONE_POLYGON
    // Traffic Chowk Butwal: 27.7006, 83.4484 is in default zone
    expect(isPointInsideAnyZone(27.7006, 83.4484, [])).toBe(true)
    expect(isPointInsideAnyZone(27.7172, 85.324, [])).toBe(false)
  })

  it('computes combined bounding box across multiple rings correctly', () => {
    const ring1: [number, number][] = [
      [27.5, 83.4],
      [27.6, 83.5],
    ]
    const ring2: [number, number][] = [
      [27.7, 83.3],
      [27.8, 83.6],
    ]

    const bounds = computeMultiRingBounds([ring1, ring2])
    expect(bounds[0]).toEqual([27.5, 83.3]) // SW
    expect(bounds[1]).toEqual([27.8, 83.6]) // NE
  })
})
