import { createFileRoute } from '@tanstack/react-router'
import { SuperAdminPanel } from '#/components/panels/superadmin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/superadmin/')({
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: SuperAdminPage,
})

function SuperAdminPage() {
  return <SuperAdminPanel />
}

