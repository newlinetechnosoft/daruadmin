import { db } from '#/db'
import { serviceZones } from '#/db/schema/zones'
import type { ServiceZone, GeoJSONPolygon } from '#/db/schema/zones'
import { eq, desc, asc } from 'drizzle-orm'
import { isPointInsideAnyZone } from '#/lib/geo-utils'
import type { ServiceZoneFeatureCollection } from '#/lib/geo-utils'

// In-memory cache for active zones with 60-second TTL
let activeZonesCache: {
  data: ServiceZone[]
  timestamp: number
} | null = null

const CACHE_TTL_MS = 60 * 1000

export function invalidateActiveZonesCache() {
  activeZonesCache = null
}

/**
 * Returns all active service zones from Neon Postgres.
 * Results are cached in memory for up to 60 seconds, or immediately invalidated on write.
 */
export async function getActiveServiceZonesQuery(): Promise<ServiceZone[]> {
  const now = Date.now()
  if (activeZonesCache && now - activeZonesCache.timestamp < CACHE_TTL_MS) {
    return activeZonesCache.data
  }

  try {
    const rows = await db
      .select()
      .from(serviceZones)
      .where(eq(serviceZones.isActive, true))
      .orderBy(asc(serviceZones.createdAt))

    activeZonesCache = {
      data: rows,
      timestamp: now,
    }
    return rows
  } catch (err: any) {
    // Graceful fallback: log concise message and return cached or empty
    const msg = err?.message || String(err)
    console.warn(`[ServiceZones] Database unavailable (${msg.slice(0, 100)}). Falling back to active cache or defaults.`)
    if (activeZonesCache?.data) {
      return activeZonesCache.data
    }
    return []
  }
}

/**
 * Returns all service zones (active and inactive) for admin management.
 */
export async function getAllServiceZonesQuery(): Promise<ServiceZone[]> {
  return await db
    .select()
    .from(serviceZones)
    .orderBy(desc(serviceZones.createdAt))
}

/**
 * Returns a specific service zone by its UUID.
 */
export async function getServiceZoneByIdQuery(
  id: string,
): Promise<ServiceZone | null> {
  const rows = await db
    .select()
    .from(serviceZones)
    .where(eq(serviceZones.id, id))
    .limit(1)

  return rows[0] || null
}

/**
 * Creates a new service zone.
 */
export async function createServiceZoneQuery(data: {
  name: string
  polygon: GeoJSONPolygon
  isActive?: boolean
}): Promise<ServiceZone> {
  const [created] = await db
    .insert(serviceZones)
    .values({
      name: data.name.trim(),
      polygon: data.polygon,
      isActive: data.isActive ?? false,
    })
    .returning()

  invalidateActiveZonesCache()
  return created
}

/**
 * Updates an existing service zone.
 */
export async function updateServiceZoneQuery(
  id: string,
  data: {
    name?: string
    polygon?: GeoJSONPolygon
    isActive?: boolean
  },
): Promise<ServiceZone | null> {
  const updatePayload: Partial<typeof serviceZones.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updatePayload.name = data.name.trim()
  if (data.polygon !== undefined) updatePayload.polygon = data.polygon
  if (data.isActive !== undefined) updatePayload.isActive = data.isActive

  const rows = await db
    .update(serviceZones)
    .set(updatePayload)
    .where(eq(serviceZones.id, id))
    .returning()

  invalidateActiveZonesCache()
  return rows[0] ?? null
}

/**
 * Deletes a service zone by ID.
 */
export async function deleteServiceZoneQuery(id: string): Promise<boolean> {
  const deleted = await db
    .delete(serviceZones)
    .where(eq(serviceZones.id, id))
    .returning({ id: serviceZones.id })

  invalidateActiveZonesCache()
  return deleted.length > 0
}

/**
 * Toggles a service zone's active status.
 */
export async function toggleServiceZoneActiveQuery(
  id: string,
  forceActive?: boolean,
): Promise<ServiceZone | null> {
  const existing = await getServiceZoneByIdQuery(id)
  if (!existing) return null

  const newActive =
    forceActive !== undefined ? forceActive : !existing.isActive

  const rows = await db
    .update(serviceZones)
    .set({
      isActive: newActive,
      updatedAt: new Date(),
    })
    .where(eq(serviceZones.id, id))
    .returning()

  invalidateActiveZonesCache()
  return rows[0] ?? null
}

/**
 * Formats a list of ServiceZone records into a standard GeoJSON FeatureCollection.
 */
export function formatZonesToFeatureCollection(
  zones: ServiceZone[],
): ServiceZoneFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      id: z.id,
      geometry: z.polygon,
      properties: {
        id: z.id,
        name: z.name,
        isActive: z.isActive,
        createdAt: z.createdAt.toISOString(),
        updatedAt: z.updatedAt.toISOString(),
        vertexCount: z.polygon.coordinates[0]?.length ?? 0,
      },
    })),
  }
}

/**
 * Server-side point-in-polygon enforcement:
 * Checks whether [lat, lng] is inside ANY active service zone from the database.
 * If database is unreachable or no active zones exist, falls back to the default hardcoded zone.
 */
export async function isLocationInActiveZones(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<boolean> {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false
  }

  const activeZones = await getActiveServiceZonesQuery()
  return isPointInsideAnyZone(lat, lng, activeZones)
}
