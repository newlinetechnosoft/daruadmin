import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { StaffPanel } from '#/components/panels/staff'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: guardModule('staff'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.staff())
  },
  component: StaffPanelPage,
})

function StaffPanelPage() {
  return <StaffPanel />
}
