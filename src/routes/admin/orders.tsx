import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { OrdersPanel } from '#/components/panels/orders'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: guardModule('orders'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.orders())
  },
  pendingComponent: () => <AdminContentSkeleton variant="stats-table" />,
  component: OrdersPanel,
})
