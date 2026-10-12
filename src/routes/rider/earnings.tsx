import { createFileRoute } from '@tanstack/react-router'
import { riderQueries } from '#/queries/rider'
import { RiderEarnings } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/earnings')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(riderQueries.portal())
  },
  component: RiderEarningsPage,
})

function RiderEarningsPage() {
  const data = Route.useLoaderData()
  return <RiderEarnings rider={data.rider} orders={data.orders} />
}
