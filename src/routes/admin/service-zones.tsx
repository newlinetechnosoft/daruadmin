import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { ServiceZonesPanel } from '#/components/panels/service-zones/service-zones-panel'
import { zoneQueries } from '#/queries/zones'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/service-zones')({
  beforeLoad: guardModule('shipping'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(zoneQueries.all())
  },
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: ServiceZonesPanel,
})
