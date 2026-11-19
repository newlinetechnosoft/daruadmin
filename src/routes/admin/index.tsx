import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { guardModule } from '#/server/auth/guards'
import { DashboardPanel } from '#/components/panels/dashboard'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

const searchSchema = z.object({
  range: z.enum(['today', '7d', '30d', '90d', 'ytd', 'custom']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const Route = createFileRoute('/admin/')({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => search,
  beforeLoad: guardModule('dashboard'),
  loader: async ({ deps, context }) => {
    return context.queryClient.ensureQueryData(
      adminQueries.dashboard({
        range: deps.range ?? '30d',
        from: deps.from,
        to: deps.to,
      }),
    )
  },
  pendingComponent: () => <AdminContentSkeleton variant="stats-table" />,
  component: DashboardPanel,
})
