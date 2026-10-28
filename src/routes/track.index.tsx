import { createFileRoute } from '@tanstack/react-router'
import { TrackOrderPanel } from '#/components/panels/customer/track-order-panel'

export const Route = createFileRoute('/track/')({
  component: TrackOrderIndexPage,
  head: () => ({
    meta: [
      {
        title: 'Track Order — Mezmani Express Delivery Butwal',
      },
    ],
  }),
})

function TrackOrderIndexPage() {
  return <TrackOrderPanel />
}
