import { createFileRoute } from '@tanstack/react-router'
import { getAllTaxonomyFn } from '#/server/catalog/catalog.functions'
import { guardModule } from '#/server/auth/guards'
import { TaxonomyPanel } from '#/components/panels/taxonomy'

export const Route = createFileRoute('/admin/taxonomy')({
  beforeLoad: guardModule('products'),
  loader: async () => {
    const taxonomy = await getAllTaxonomyFn()
    return { taxonomy }
  },
  component: TaxonomyPanel,
})
