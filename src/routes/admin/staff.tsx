import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { StaffPanel } from '#/components/panels/staff'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: guardModule('staff'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.staff())
  },
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: StaffPanelPage,
})

function StaffPanelPage() {
  return <StaffPanel />
}
