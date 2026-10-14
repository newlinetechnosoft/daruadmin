import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { BrandsPanel } from '#/components/panels/brands'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/brands')({
  beforeLoad: guardModule('brands'),
  loader: async ({ context }) => {
    const brands = await context.queryClient.ensureQueryData(
      adminQueries.brands(),
    )
    return { brands }
  },
  component: BrandsPanel,
})
