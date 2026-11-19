import { createFileRoute } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { DealerForm } from '#/components/panels/dealers/dealer-form'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/dealers/new')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.dealers())
  },
  pendingComponent: () => <AdminContentSkeleton variant="form" />,
  component: () => <DealerForm />,
})
