import { createFileRoute } from '@tanstack/react-router'
import { getAdminUsersFn } from '#/server/catalog/catalog.functions'
import { guardModule } from '#/server/auth/guards'
import { UsersPanel } from '#/components/panels/users'

export const Route = createFileRoute('/admin/users')({
  beforeLoad: guardModule('staff'),
  loader: async () => {
    const users = await getAdminUsersFn()
    return { users }
  },
  component: UsersPanel,
})
