import { createFileRoute } from '@tanstack/react-router'
import { getMarketingFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { MarketingPanel } from '#/components/panels/marketing'

export const Route = createFileRoute('/admin/marketing')({
  beforeLoad: guardModule('marketing'),
  loader: async () => {
    return getMarketingFn()
  },
  component: MarketingPanel,
})
