import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { DealersPanel } from '#/components/panels/dealers'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/dealers')({
  beforeLoad: guardModule('dealers'),
  loader: async ({ context }) => {
    const dealers = await context.queryClient.ensureQueryData(
      adminQueries.dealers(),
    )
    return { dealers }
  },
  component: DealersPanel,
})
