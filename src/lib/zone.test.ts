import { describe, expect, it } from 'bun:test'
import {
  ZONE_POLYGON,
  isInsideZone,
  getZoneBBox,
  getZoneCenter,
  WORLD_MASK_RING,
  ZONE_CONFIG,
} from './zone'

describe('Service Zone Polygon & Boundary Checks', () => {
  it('has a closed ring polygon (first point equals last point)', () => {
    expect(ZONE_POLYGON.length).toBeGreaterThanOrEqual(4)
    const first = ZONE_POLYGON[0]
    const last = ZONE_POLYGON[ZONE_POLYGON.length - 1]
    expect(first[0]).toBe(last[0])
    expect(first[1]).toBe(last[1])
  })

  it('correctly validates coordinates inside Butwal, Tilottama & Bhairahawa', () => {
    // Traffic Chowk, Butwal
    expect(isInsideZone(27.7006, 83.4484)).toBe(true)
    // Golpark, Butwal
    expect(isInsideZone(27.708, 83.458)).toBe(true)
    // Drivertole / Manigram, Tilottama
    expect(isInsideZone(27.652, 83.468)).toBe(true)
    // Kotihawa
    expect(isInsideZone(27.575, 83.462)).toBe(true)
    // Bhairahawa (Siddharthanagar)
    expect(isInsideZone(27.5065, 83.4542)).toBe(true)
  })

  it('correctly rejects coordinates outside the service zone', () => {
    // Kathmandu
    expect(isInsideZone(27.7172, 85.324)).toBe(false)
    // Pokhara
    expect(isInsideZone(28.2096, 83.9856)).toBe(false)
    // Nepalgunj (far west)
    expect(isInsideZone(28.05, 81.6167)).toBe(false)
    // Tansen / Palpa (north of Butwal)
    expect(isInsideZone(27.8667, 83.55)).toBe(false)
    // Lumbini Cultural Zone (west of service area)
    expect(isInsideZone(27.48, 83.28)).toBe(false)
    // Null & undefined & NaN
    expect(isInsideZone(null, null)).toBe(false)
    expect(isInsideZone(undefined, undefined)).toBe(false)
    expect(isInsideZone(NaN, NaN)).toBe(false)
  })

  it('computes correct bounding box and center', () => {
    const bbox = getZoneBBox()
    expect(bbox.minLat).toBe(27.505727)
    expect(bbox.maxLat).toBe(27.737863)
    expect(bbox.minLng).toBe(83.385857)
    expect(bbox.maxLng).toBe(83.527641)

    const center = getZoneCenter()
    expect(center[0]).toBeCloseTo(27.621795, 4)
    expect(center[1]).toBeCloseTo(83.456749, 4)
  })

  it('defines valid world mask ring and default zone configuration', () => {
    expect(WORLD_MASK_RING).toHaveLength(4)
    expect(ZONE_CONFIG.maskPaneZIndex).toBe(450)
    expect(ZONE_CONFIG.maxBoundsViscosity).toBe(1.0)
    expect(ZONE_CONFIG.padding).toBe(0.05)
  })
})
