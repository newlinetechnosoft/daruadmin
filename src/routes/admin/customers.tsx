import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { CustomersPanel } from '#/components/panels/customers'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/customers')({
  beforeLoad: guardModule('customers'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.customers())
  },
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: CustomersPanel,
})
