import { createFileRoute } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { DealerForm } from '#/components/panels/dealers/dealer-form'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/dealers/$id')({
  loader: async ({ params, context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(adminQueries.dealers()),
      context.queryClient.ensureQueryData(adminQueries.dealer(params.id)),
    ])
  },
  pendingComponent: () => <AdminContentSkeleton variant="form" />,
  component: DealerDetailPage,
})

function DealerDetailPage() {
  const { id } = Route.useParams()
  return <DealerForm dealerId={id} />
}
