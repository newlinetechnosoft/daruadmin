import { createFileRoute } from '@tanstack/react-router'
import { SuperAdminPanel } from '#/components/panels/superadmin'

export const Route = createFileRoute('/superadmin/')({
  component: SuperAdminPage,
})

function SuperAdminPage() {
  return <SuperAdminPanel />
}
