import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { BannersPanel } from '#/components/panels/banners'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/banners')({
  beforeLoad: guardModule('marketing'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.banners())
  },
  component: BannersPanel,
})
