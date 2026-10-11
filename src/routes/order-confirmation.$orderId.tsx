import { createFileRoute } from '@tanstack/react-router'
import { OrderConfirmationPanel } from '#/components/panels/customer/order-confirmation-panel'

export const Route = createFileRoute('/order-confirmation/$orderId')({
  component: OrderConfirmationPage,
})

function OrderConfirmationPage() {
  const { orderId } = Route.useParams()
  return <OrderConfirmationPanel orderId={orderId} />
}
