import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { FoodPanel } from '#/components/panels/food'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/food')({
  beforeLoad: guardModule('food'),
  loader: async ({ context }) => {
    const [products, taxonomy] = await Promise.all([
      context.queryClient.ensureQueryData(adminQueries.foodProducts()),
      context.queryClient.ensureQueryData(adminQueries.taxonomy()),
    ])
    return { products, taxonomy }
  },
  component: FoodPanel,
})
