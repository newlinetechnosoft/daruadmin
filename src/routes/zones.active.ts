import { createFileRoute } from '@tanstack/react-router'
import {
  getActiveServiceZonesQuery,
  formatZonesToFeatureCollection,
} from '#/server/zones/zones.queries'

export const Route = createFileRoute('/zones/active')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const zones = await getActiveServiceZonesQuery()
          const featureCollection = formatZonesToFeatureCollection(zones)

          return new Response(JSON.stringify(featureCollection), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control':
                'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
            },
          })
        } catch (error: any) {
          console.error('[API /zones/active] Error:', error)
          return new Response(
            JSON.stringify({
              error: error?.message || 'Failed to fetch active service zones',
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
