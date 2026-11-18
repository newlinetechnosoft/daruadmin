import { createFileRoute } from '@tanstack/react-router'
import { executeCampaignExpiry } from '#/server/scheduler/campaign-scheduler'

export const Route = createFileRoute('/api/jobs/campaigns/expire')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { campaignId?: string }
          if (!body?.campaignId) {
            return new Response(
              JSON.stringify({ error: 'Missing campaignId in request body' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const result = await executeCampaignExpiry(body.campaignId)
          return new Response(JSON.stringify(result, null, 2), {
            status: result.success ? 200 : 422,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(
            JSON.stringify({
              success: false,
              error: error?.message || String(error),
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
