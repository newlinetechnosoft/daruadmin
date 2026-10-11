import { createFileRoute } from '@tanstack/react-router'
import {
  getAdminGroceryProductsFn,
  getAllTaxonomyFn,
} from '#/server/catalog/catalog.functions'
import { guardModule } from '#/server/auth/guards'
import { GroceryPanel } from '#/components/panels/grocery'

export const Route = createFileRoute('/admin/grocery')({
  beforeLoad: guardModule('products'),
  loader: async () => {
    const [products, taxonomy] = await Promise.all([
      getAdminGroceryProductsFn(),
      getAllTaxonomyFn(),
    ])
    return { products, taxonomy }
  },
  component: GroceryPanel,
})
