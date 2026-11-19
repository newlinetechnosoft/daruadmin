import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { MarketingPanel } from '#/components/panels/marketing'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/marketing')({
  beforeLoad: guardModule('marketing'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.marketing())
  },
  pendingComponent: () => <AdminContentSkeleton variant="stats-table" />,
  component: MarketingPanel,
})
