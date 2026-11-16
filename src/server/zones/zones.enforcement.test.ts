import { describe, expect, it } from 'bun:test'
import { isLocationInActiveZones } from './zones.queries'

describe('Server-Side Service Zone Enforcement', () => {
  it('accepts locations inside active service zones (Butwal/Tilottama/Bhairahawa)', async () => {
    // Traffic Chowk, Butwal
    const butwal = await isLocationInActiveZones(27.7006, 83.4484)
    expect(butwal).toBe(true)

    // Tilottama (Manigram)
    const tilottama = await isLocationInActiveZones(27.652, 83.468)
    expect(tilottama).toBe(true)

    // Bhairahawa
    const bhairahawa = await isLocationInActiveZones(27.5065, 83.4542)
    expect(bhairahawa).toBe(true)
  })

  it('rejects locations outside active service zones', async () => {
    // Kathmandu
    const ktm = await isLocationInActiveZones(27.7172, 85.324)
    expect(ktm).toBe(false)

    // Pokhara
    const pokhara = await isLocationInActiveZones(28.2096, 83.9856)
    expect(pokhara).toBe(false)

    // Null/undefined/NaN values
    expect(await isLocationInActiveZones(null, null)).toBe(false)
    expect(await isLocationInActiveZones(undefined, undefined)).toBe(false)
    expect(await isLocationInActiveZones(NaN, NaN)).toBe(false)
  })
})
