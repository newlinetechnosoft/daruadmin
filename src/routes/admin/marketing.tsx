import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { MarketingPanel } from '#/components/panels/marketing'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/marketing')({
  beforeLoad: guardModule('marketing'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.marketing())
  },
  component: MarketingPanel,
})
