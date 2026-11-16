import { createFileRoute } from '@tanstack/react-router'
import {
  getAllServiceZonesQuery,
  createServiceZoneQuery,
} from '#/server/zones/zones.queries'
import { checkRestAdminAuth } from '#/server/zones/zones.auth'
import { validateZonePolygon } from '#/lib/geo-utils'
import { logAudit } from '#/server/auth/permissions'
import type { GeoJSONPolygon } from '#/db/schema/zones'

export const Route = createFileRoute('/zones/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authCheck = await checkRestAdminAuth(request)
        if (!authCheck.authorized) {
          return authCheck.response
        }

        try {
          const zones = await getAllServiceZonesQuery()
          return new Response(JSON.stringify(zones), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error?.message || 'Failed to list service zones',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },

      POST: async ({ request }) => {
        const authCheck = await checkRestAdminAuth(request)
        if (!authCheck.authorized) {
          return authCheck.response
        }

        try {
          const body = await request.json()
          if (!body || typeof body !== 'object') {
            return new Response(
              JSON.stringify({ error: 'Request body must be a JSON object' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const { name, polygon, isActive } = body
          if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return new Response(
              JSON.stringify({
                error: 'Field "name" is required and must be at least 2 characters',
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const validation = validateZonePolygon(polygon)
          if (!validation.valid) {
            return new Response(
              JSON.stringify({ error: validation.error }),
              { status: 422, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const created = await createServiceZoneQuery({
            name: name.trim(),
            polygon: polygon as GeoJSONPolygon,
            isActive: Boolean(isActive),
          })

          await logAudit(
            authCheck.user.name || authCheck.user.email,
            'shipping',
            'create_service_zone',
            `Created service zone "${created.name}" (ID: ${created.id})`,
          )

          return new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error?.message || 'Failed to create service zone',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
