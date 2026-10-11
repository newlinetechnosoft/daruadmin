import { createFileRoute } from '@tanstack/react-router'
import {
  getAdminLiquorProductsFn,
  getAllTaxonomyFn,
} from '#/server/catalog/catalog.functions'
import { guardModule } from '#/server/auth/guards'
import { LiquorPanel } from '#/components/panels/liquor'

export const Route = createFileRoute('/admin/liquor')({
  beforeLoad: guardModule('products'),
  loader: async () => {
    const [products, taxonomy] = await Promise.all([
      getAdminLiquorProductsFn(),
      getAllTaxonomyFn(),
    ])
    return { products, taxonomy }
  },
  component: LiquorPanel,
})
