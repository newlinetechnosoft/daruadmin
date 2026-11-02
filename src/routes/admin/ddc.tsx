import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { DdcPanel } from '#/components/panels/ddc'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/ddc')({
  beforeLoad: guardModule('ddc'),
  loader: async ({ context }) => {
    const [products, taxonomy] = await Promise.all([
      context.queryClient.ensureQueryData(adminQueries.ddcProducts()),
      context.queryClient.ensureQueryData(adminQueries.taxonomy()),
    ])
    return { products, taxonomy }
  },
  component: DdcPanel,
})
