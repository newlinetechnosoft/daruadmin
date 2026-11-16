import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getActiveServiceZonesQuery,
  getAllServiceZonesQuery,
  getServiceZoneByIdQuery,
  createServiceZoneQuery,
  updateServiceZoneQuery,
  deleteServiceZoneQuery,
  toggleServiceZoneActiveQuery,
  formatZonesToFeatureCollection,
} from './zones.queries'
import { validateZonePolygon } from '#/lib/geo-utils'
import { getSessionUser, logAudit, isSuperAdmin } from '#/server/auth/permissions'
import type { GeoJSONPolygon } from '#/db/schema/zones'

/**
 * Server guard: verifies that the user is an admin or superadmin.
 */
async function requireZoneAdmin() {
  const user = await getSessionUser()
  const isSuper = isSuperAdmin(user)
  if (!isSuper && user.role !== 'admin' && user.role !== 'manager') {
    throw new Error('403: Forbidden: Staff privileges required to manage service zones')
  }
  return user
}

// ---------------------------------------------------------------------------
// 1. GET ACTIVE ZONES (Public)
// ---------------------------------------------------------------------------
export const getActiveZonesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const zones = await getActiveServiceZonesQuery()
    return formatZonesToFeatureCollection(zones)
  },
)

// ---------------------------------------------------------------------------
// 2. GET ALL ZONES (Admin)
// ---------------------------------------------------------------------------
export const getAllZonesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireZoneAdmin()
    return await getAllServiceZonesQuery()
  },
)

// ---------------------------------------------------------------------------
// 3. CREATE ZONE (Admin)
// ---------------------------------------------------------------------------
export const createZoneFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => {
    if (typeof d !== 'object' || d === null) {
      throw new Error('Invalid request payload')
    }
    const raw = d as { name?: string; polygon?: unknown; isActive?: boolean }
    if (!raw.name || typeof raw.name !== 'string' || raw.name.trim().length < 2) {
      throw new Error('Zone name is required (min 2 characters)')
    }
    const validation = validateZonePolygon(raw.polygon)
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid polygon geometry')
    }
    return {
      name: raw.name.trim(),
      polygon: raw.polygon as GeoJSONPolygon,
      isActive: Boolean(raw.isActive),
    }
  })
  .handler(async ({ data }) => {
    const user = await requireZoneAdmin()
    const created = await createServiceZoneQuery({
      name: data.name,
      polygon: data.polygon,
      isActive: data.isActive,
    })

    await logAudit(
      user.name,
      'shipping',
      'create_service_zone',
      `Created service zone "${created.name}" (ID: ${created.id})`,
    )

    return created
  })

// ---------------------------------------------------------------------------
// 4. UPDATE ZONE (Admin)
// ---------------------------------------------------------------------------
export const updateZoneFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => {
    if (typeof d !== 'object' || d === null) {
      throw new Error('Invalid request payload')
    }
    const raw = d as {
      id?: string
      name?: string
      polygon?: unknown
      isActive?: boolean
    }
    if (!raw.id || typeof raw.id !== 'string') {
      throw new Error('Zone ID is required')
    }
    if (raw.name !== undefined && (typeof raw.name !== 'string' || raw.name.trim().length < 2)) {
      throw new Error('Zone name must be at least 2 characters')
    }
    if (raw.polygon !== undefined) {
      const validation = validateZonePolygon(raw.polygon)
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid polygon geometry')
      }
    }
    return {
      id: raw.id,
      name: raw.name?.trim(),
      polygon: raw.polygon as GeoJSONPolygon | undefined,
      isActive: raw.isActive,
    }
  })
  .handler(async ({ data }) => {
    const user = await requireZoneAdmin()
    const updated = await updateServiceZoneQuery(data.id, {
      name: data.name,
      polygon: data.polygon,
      isActive: data.isActive,
    })

    if (!updated) {
      throw new Error(`Service zone with ID ${data.id} not found`)
    }

    await logAudit(
      user.name,
      'shipping',
      'update_service_zone',
      `Updated service zone "${updated.name}" (ID: ${updated.id})`,
    )

    return updated
  })

// ---------------------------------------------------------------------------
// 5. DELETE ZONE (Admin)
// ---------------------------------------------------------------------------
export const deleteZoneFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid('Valid UUID required') }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireZoneAdmin()
    const existing = await getServiceZoneByIdQuery(data.id)
    if (!existing) {
      throw new Error(`Service zone with ID ${data.id} not found`)
    }

    const success = await deleteServiceZoneQuery(data.id)
    if (!success) {
      throw new Error(`Failed to delete service zone ${data.id}`)
    }

    await logAudit(
      user.name,
      'shipping',
      'delete_service_zone',
      `Deleted service zone "${existing.name}" (ID: ${existing.id})`,
    )

    return { success: true }
  })

// ---------------------------------------------------------------------------
// 6. TOGGLE ACTIVE (Admin)
// ---------------------------------------------------------------------------
export const toggleZoneActiveFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid('Valid UUID required'),
        isActive: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireZoneAdmin()
    const updated = await toggleServiceZoneActiveQuery(data.id, data.isActive)
    if (!updated) {
      throw new Error(`Service zone with ID ${data.id} not found`)
    }

    await logAudit(
      user.name,
      'shipping',
      'toggle_service_zone',
      `Toggled service zone "${updated.name}" active status to ${updated.isActive}`,
    )

    return updated
  })
