import { createFileRoute } from '@tanstack/react-router'
import { OrderConfirmationPanel } from '#/components/panels/customer/order-confirmation-panel'
import { TrackOrderSkeleton } from '#/components/store/skeletons'

export const Route = createFileRoute('/order-confirmation/$orderId')({
  pendingComponent: TrackOrderSkeleton,
  component: OrderConfirmationPage,
})

function OrderConfirmationPage() {
  const { orderId } = Route.useParams()
  return <OrderConfirmationPanel orderId={orderId} />
}
