import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { RidersPanel } from '#/components/panels/riders'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/riders')({
  beforeLoad: guardModule('riders'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.riders())
  },
  pendingComponent: () => <AdminContentSkeleton variant="stats-table" />,
  component: RidersPanel,
})
