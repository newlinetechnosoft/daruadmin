import { createFileRoute } from '@tanstack/react-router'
import { getRiderPortalFn } from '#/server/operations/operations.functions'
import { RiderDashboard } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/')({
  loader: async () => {
    return getRiderPortalFn()
  },
  component: RiderDashboardPage,
})

function RiderDashboardPage() {
  const data = Route.useLoaderData()
  return <RiderDashboard data={data} />
}
