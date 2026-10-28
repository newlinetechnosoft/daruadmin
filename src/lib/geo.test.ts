import { describe, expect, it } from 'bun:test'
import {
  calculateHaversineDistanceKm,
  formatDistanceKm,
  isPointWithinRadius,
  sortLocationsByDistance,
  getDealerWhatsAppConfirmationUrl,
  isWithinButwalArea,
  BUTWAL_MAP_BOUNDS,
  DEFAULT_MAP_CENTER,
} from './geo'

describe('Geospatial & Sourcing Distance Utilities', () => {
  // Butwal Traffic Chowk coordinates
  const butwal = { lat: 27.7006, lng: 83.4484 }
  // Tilottama (approx ~8 km south)
  const tilottama = { lat: 27.6333, lng: 83.4667 }
  // Siddharthanagar / Bhairahawa (approx ~20 km south)
  const bhairahawa = { lat: 27.5065, lng: 83.4542 }
  // Kathmandu center (approx ~200 km east)
  const kathmandu = { lat: 27.7172, lng: 85.324 }

  it('validates Butwal delivery area bounds correctly', () => {
    // Default center (Traffic Chowk) should be within Butwal area
    expect(
      isWithinButwalArea(DEFAULT_MAP_CENTER[0], DEFAULT_MAP_CENTER[1]),
    ).toBe(true)
    expect(isWithinButwalArea(butwal.lat, butwal.lng)).toBe(true)
    expect(isWithinButwalArea(tilottama.lat, tilottama.lng)).toBe(true)

    // Kathmandu must NEVER be recognized as inside Butwal
    expect(isWithinButwalArea(kathmandu.lat, kathmandu.lng)).toBe(false)
    expect(isWithinButwalArea(null, null)).toBe(false)
    expect(isWithinButwalArea(NaN, NaN)).toBe(false)

    // Check bounds
    expect(BUTWAL_MAP_BOUNDS[0][0]).toBeLessThan(DEFAULT_MAP_CENTER[0])
    expect(BUTWAL_MAP_BOUNDS[1][0]).toBeGreaterThan(DEFAULT_MAP_CENTER[0])
    expect(BUTWAL_MAP_BOUNDS[0][1]).toBeLessThan(DEFAULT_MAP_CENTER[1])
    expect(BUTWAL_MAP_BOUNDS[1][1]).toBeGreaterThan(DEFAULT_MAP_CENTER[1])
  })

  it('calculates accurate Haversine distance between Butwal and Tilottama', () => {
    const dist = calculateHaversineDistanceKm(
      butwal.lat,
      butwal.lng,
      tilottama.lat,
      tilottama.lng,
    )
    expect(dist).toBeGreaterThan(7)
    expect(dist).toBeLessThan(9)
  })

  it('calculates distance between Butwal and Bhairahawa', () => {
    const dist = calculateHaversineDistanceKm(
      butwal.lat,
      butwal.lng,
      bhairahawa.lat,
      bhairahawa.lng,
    )
    expect(dist).toBeGreaterThan(20)
    expect(dist).toBeLessThan(23)
  })

  it('formats distance correctly in meters and kilometers', () => {
    expect(formatDistanceKm(0.45)).toBe('450 m')
    expect(formatDistanceKm(2.35)).toBe('2.4 km')
    expect(formatDistanceKm(null)).toBe('Unknown distance')
  })

  it('verifies points within radius correctly', () => {
    expect(isPointWithinRadius(butwal, tilottama, 10)).toBe(true)
    expect(isPointWithinRadius(butwal, bhairahawa, 10)).toBe(false)
    expect(isPointWithinRadius(butwal, bhairahawa, 25)).toBe(true)
  })

  it('sorts locations by distance from origin ascending', () => {
    const dealers = [
      { id: 'bhairahawa_dealer', name: 'Bhairahawa Store', ...bhairahawa },
      { id: 'tilottama_dealer', name: 'Tilottama Store', ...tilottama },
      { id: 'butwal_dealer', name: 'Butwal Central Store', ...butwal },
      { id: 'no_coords_dealer', name: 'Unknown Store', lat: null, lng: null },
    ]

    const sorted = sortLocationsByDistance(butwal, dealers)

    expect(sorted[0].id).toBe('butwal_dealer')
    expect(sorted[0].distanceKm).toBe(0)
    expect(sorted[1].id).toBe('tilottama_dealer')
    expect(sorted[2].id).toBe('bhairahawa_dealer')
    expect(sorted[3].id).toBe('no_coords_dealer')
    expect(sorted[3].distanceKm).toBeNull()
  })

  it('generates a valid WhatsApp confirmation URL for a dealer', () => {
    const url = getDealerWhatsAppConfirmationUrl({
      dealerName: 'Lumbini Liquor Store',
      dealerPhone: '+977-9800000000',
      orderNumber: 'ORD-10023',
      items: [
        { name: 'Khukri XXX Rum', qty: 2, variantName: '750ml' },
        { name: 'Tuborg Classic', qty: 6, variantName: '650ml' },
      ],
    })

    expect(url).toContain('https://wa.me/9779800000000')
    expect(url).toContain('ORD-10023')
    expect(url).toContain('Khukri%20XXX%20Rum')
  })
})
