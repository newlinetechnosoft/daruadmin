import { createFileRoute } from '@tanstack/react-router'
import {
  getServiceZoneByIdQuery,
  updateServiceZoneQuery,
  deleteServiceZoneQuery,
} from '#/server/zones/zones.queries'
import { checkRestAdminAuth } from '#/server/zones/zones.auth'
import { validateZonePolygon } from '#/lib/geo-utils'
import { logAudit } from '#/server/auth/permissions'
import type { GeoJSONPolygon } from '#/db/schema/zones'

export const Route = createFileRoute('/zones/$id')({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const authCheck = await checkRestAdminAuth(request)
        if (!authCheck.authorized) {
          return authCheck.response
        }

        const { id } = params
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing zone ID in route params' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
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

          if (
            name !== undefined &&
            (typeof name !== 'string' || name.trim().length < 2)
          ) {
            return new Response(
              JSON.stringify({
                error: 'Field "name" must be at least 2 characters',
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (polygon !== undefined) {
            const validation = validateZonePolygon(polygon)
            if (!validation.valid) {
              return new Response(
                JSON.stringify({ error: validation.error }),
                { status: 422, headers: { 'Content-Type': 'application/json' } },
              )
            }
          }

          const updated = await updateServiceZoneQuery(id, {
            name: name !== undefined ? name.trim() : undefined,
            polygon: polygon as GeoJSONPolygon | undefined,
            isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          })

          if (!updated) {
            return new Response(
              JSON.stringify({ error: `Service zone ${id} not found` }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            )
          }

          await logAudit(
            authCheck.user.name || authCheck.user.email,
            'shipping',
            'update_service_zone',
            `Updated service zone "${updated.name}" (ID: ${updated.id})`,
          )

          return new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error?.message || 'Failed to update service zone',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },

      DELETE: async ({ request, params }) => {
        const authCheck = await checkRestAdminAuth(request)
        if (!authCheck.authorized) {
          return authCheck.response
        }

        const { id } = params
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing zone ID in route params' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        try {
          const existing = await getServiceZoneByIdQuery(id)
          if (!existing) {
            return new Response(
              JSON.stringify({ error: `Service zone ${id} not found` }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const success = await deleteServiceZoneQuery(id)
          if (!success) {
            return new Response(
              JSON.stringify({ error: `Failed to delete service zone ${id}` }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }

          await logAudit(
            authCheck.user.name || authCheck.user.email,
            'shipping',
            'delete_service_zone',
            `Deleted service zone "${existing.name}" (ID: ${existing.id})`,
          )

          return new Response(
            JSON.stringify({ success: true, id }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error?.message || 'Failed to delete service zone',
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
