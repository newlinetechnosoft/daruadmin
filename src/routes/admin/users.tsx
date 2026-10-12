import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { UsersPanel } from '#/components/panels/users'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/users')({
  beforeLoad: guardModule('staff'),
  loader: async ({ context }) => {
    const users = await context.queryClient.ensureQueryData(
      adminQueries.users(),
    )
    return { users }
  },
  component: UsersPanel,
})
