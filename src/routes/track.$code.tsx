import { createFileRoute } from '@tanstack/react-router'
import { TrackOrderPanel } from '#/components/panels/customer/track-order-panel'

export const Route = createFileRoute('/track/$code')({
  component: TrackOrderCodePage,
  head: () => ({
    meta: [
      {
        title: 'Track Order — Mezmani Express Delivery Butwal',
      },
    ],
  }),
})

function TrackOrderCodePage() {
  const { code } = Route.useParams()
  return <TrackOrderPanel initialCode={code} />
}
