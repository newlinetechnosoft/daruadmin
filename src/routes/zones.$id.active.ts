import { createFileRoute } from '@tanstack/react-router'
import {
  toggleServiceZoneActiveQuery,
  getServiceZoneByIdQuery,
} from '#/server/zones/zones.queries'
import { checkRestAdminAuth } from '#/server/zones/zones.auth'
import { logAudit } from '#/server/auth/permissions'

export const Route = createFileRoute('/zones/$id/active')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
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

          let forceActive: boolean | undefined
          try {
            const body = await request.json()
            if (body && typeof body.isActive === 'boolean') {
              forceActive = body.isActive
            }
          } catch {
            // If body is empty or not JSON, toggle current value
          }

          const updated = await toggleServiceZoneActiveQuery(id, forceActive)
          if (!updated) {
            return new Response(
              JSON.stringify({ error: `Service zone ${id} not found` }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            )
          }

          await logAudit(
            authCheck.user.name || authCheck.user.email,
            'shipping',
            'toggle_service_zone',
            `Toggled service zone "${updated.name}" active status to ${updated.isActive}`,
          )

          return new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              error: error?.message || 'Failed to toggle service zone status',
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
