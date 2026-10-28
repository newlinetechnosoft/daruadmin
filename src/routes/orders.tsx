import { createFileRoute } from '@tanstack/react-router'
import { CustomerOrdersPanel } from '#/components/panels/customer/customer-orders-panel'

export const Route = createFileRoute('/orders')({
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
