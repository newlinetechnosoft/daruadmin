import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { SettingsPanel } from '#/components/panels/settings'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/settings')({
  beforeLoad: guardModule('settings'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.settings())
  },
  pendingComponent: () => <AdminContentSkeleton variant="form" />,
  component: SettingsPanel,
})
