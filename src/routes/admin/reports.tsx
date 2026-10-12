import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { ReportsPanel } from '#/components/panels/reports'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/reports')({
  beforeLoad: guardModule('reports'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.reports())
  },
  component: ReportsPanel,
})
