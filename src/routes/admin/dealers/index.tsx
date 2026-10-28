import { createFileRoute } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { DealersList } from '#/components/panels/dealers/dealers-list'

export const Route = createFileRoute('/admin/dealers/')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.dealers())
  },
  component: DealersList,
})
