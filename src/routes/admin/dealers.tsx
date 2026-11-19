import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/dealers')({
  beforeLoad: guardModule('dealers'),
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: () => <Outlet />,
})
