import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { ShippingPanel } from '#/components/panels/shipping'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/shipping')({
  beforeLoad: guardModule('shipping'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.shipping())
  },
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: ShippingPanel,
})
