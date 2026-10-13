import { createFileRoute } from '@tanstack/react-router'
import { verifyNeonServicesFn } from '#/server/catalog/catalog.functions'

export const Route = createFileRoute('/api/neon-health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await verifyNeonServicesFn()
          return new Response(JSON.stringify(result, null, 2), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify(
              {
                status: 'error',
                message: error?.message || String(error),
              },
              null,
              2,
            ),
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
