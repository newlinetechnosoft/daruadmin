import { createFileRoute } from '@tanstack/react-router'
import { CustomerOrdersPanel } from '#/components/panels/customer/customer-orders-panel'
import { OrdersPageSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/orders')({
  pendingComponent: OrdersPageSkeleton,
  component: OrdersPage,
  head: () => ({
    meta: [
      {
        title: 'My Orders & Purchase History — Mezmani Nepal',
      },
    ],
  }),
})

function OrdersPage() {
  return <CustomerOrdersPanel />
}
