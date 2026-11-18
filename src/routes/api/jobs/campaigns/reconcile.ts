import { createFileRoute } from '@tanstack/react-router'
import { reconcileOverdueCampaigns } from '#/server/scheduler/campaign-scheduler'

export const Route = createFileRoute('/api/jobs/campaigns/reconcile')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const report = await reconcileOverdueCampaigns()
          return new Response(JSON.stringify({ status: 'ok', report }, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              status: 'error',
              error: error?.message || String(error),
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
      POST: async () => {
        try {
          const report = await reconcileOverdueCampaigns()
          return new Response(JSON.stringify({ status: 'ok', report }, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              status: 'error',
              error: error?.message || String(error),
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
