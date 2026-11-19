import { createFileRoute } from '@tanstack/react-router'
import { TrackOrderPanel } from '#/components/panels/customer/track-order-panel'
import { TrackOrderSkeleton } from '#/components/store/skeletons'

export const Route = createFileRoute('/track/')({
  pendingComponent: TrackOrderSkeleton,
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
