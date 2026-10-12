import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { LiquorPanel } from '#/components/panels/liquor'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/liquor')({
  beforeLoad: guardModule('products'),
  loader: async ({ context }) => {
    const [products, taxonomy] = await Promise.all([
      context.queryClient.ensureQueryData(adminQueries.liquorProducts()),
      context.queryClient.ensureQueryData(adminQueries.taxonomy()),
    ])
    return { products, taxonomy }
  },
  component: LiquorPanel,
})
