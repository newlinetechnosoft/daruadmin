import { createFileRoute } from '@tanstack/react-router'
import { getOrdersFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { OrdersPanel } from '#/components/panels/orders'

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: guardModule('orders'),
  loader: async () => {
    return getOrdersFn()
  },
  component: OrdersPanel,
})
