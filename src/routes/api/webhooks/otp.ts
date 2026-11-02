import { createFileRoute } from '@tanstack/react-router'
import { processNepalOtpWebhook } from '#/server/otp/nepalotp-webhook'

export const Route = createFileRoute('/api/webhooks/otp')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'nepalotp-webhook',
            timestamp: new Date().toISOString(),
            configured: Boolean(process.env.NEPALOTP_WEBHOOK_SECRET),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      },

      POST: async ({ request }) => {
        try {
          const rawBody = await request.text()
          const result = await processNepalOtpWebhook(rawBody, request.headers)

          return new Response(
            JSON.stringify({
              success: result.success,
              message: result.message,
              event: result.event,
              data: result.data,
            }),
            {
              status: result.status,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        } catch (error: any) {
          console.error('[NepalOTP Webhook] Fatal handler error:', error)
          return new Response(
            JSON.stringify({
              success: false,
              message: error?.message || 'Internal server error processing webhook',
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }
      },
    },
  },
})
