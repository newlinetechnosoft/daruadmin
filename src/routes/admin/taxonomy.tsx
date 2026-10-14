import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { TaxonomyPanel } from '#/components/panels/taxonomy'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/taxonomy')({
  beforeLoad: guardModule('categories'),
  loader: async ({ context }) => {
    const taxonomy = await context.queryClient.ensureQueryData(
      adminQueries.taxonomy(),
    )
    return { taxonomy }
  },
  component: TaxonomyPanel,
})
