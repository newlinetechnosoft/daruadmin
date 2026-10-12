import { createFileRoute } from '@tanstack/react-router'
import { riderQueries } from '#/queries/rider'
import { RiderDashboard } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(riderQueries.portal())
  },
  component: RiderDashboardPage,
})

function RiderDashboardPage() {
  const data = Route.useLoaderData()
  return <RiderDashboard data={data} />
}
