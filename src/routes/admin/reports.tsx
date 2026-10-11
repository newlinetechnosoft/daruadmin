import { createFileRoute } from '@tanstack/react-router'
import { getReportsOpsFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { ReportsPanel } from '#/components/panels/reports'

export const Route = createFileRoute('/admin/reports')({
  beforeLoad: guardModule('reports'),
  loader: async () => {
    return getReportsOpsFn()
  },
  component: ReportsPanel,
})
