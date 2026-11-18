import { createFileRoute } from '@tanstack/react-router'
import { TrackOrderPanel } from '#/components/panels/customer/track-order-panel'
import { OrdersPageSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/track/$code')({
  pendingComponent: OrdersPageSkeleton,
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
