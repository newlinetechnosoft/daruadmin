import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { RidersPanel } from '#/components/panels/riders'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/riders')({
  beforeLoad: guardModule('riders'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.riders())
  },
  component: RidersPanel,
})
