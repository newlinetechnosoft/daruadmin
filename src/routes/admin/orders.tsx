import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { OrdersPanel } from '#/components/panels/orders'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: guardModule('orders'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.orders())
  },
  component: OrdersPanel,
})
