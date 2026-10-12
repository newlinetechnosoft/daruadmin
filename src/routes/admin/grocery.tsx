import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { GroceryPanel } from '#/components/panels/grocery'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/grocery')({
  beforeLoad: guardModule('products'),
  loader: async ({ context }) => {
    const [products, taxonomy] = await Promise.all([
      context.queryClient.ensureQueryData(adminQueries.groceryProducts()),
      context.queryClient.ensureQueryData(adminQueries.taxonomy()),
    ])
    return { products, taxonomy }
  },
  component: GroceryPanel,
})
