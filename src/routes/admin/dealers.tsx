import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'

export const Route = createFileRoute('/admin/dealers')({
  beforeLoad: guardModule('dealers'),
  component: () => <Outlet />,
})
