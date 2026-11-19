import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { BrandsPanel } from '#/components/panels/brands'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/brands')({
  beforeLoad: guardModule('brands'),
  loader: async ({ context }) => {
    const brands = await context.queryClient.ensureQueryData(
      adminQueries.brands(),
    )
    return { brands }
  },
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: BrandsPanel,
})
