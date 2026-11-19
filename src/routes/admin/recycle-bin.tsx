import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { RecycleBinPanel } from '#/components/panels/recycle-bin'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/recycle-bin')({
  beforeLoad: guardModule('settings'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.recycleBin())
  },
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: RecycleBinPanel,
})
