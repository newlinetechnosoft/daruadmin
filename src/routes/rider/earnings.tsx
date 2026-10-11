import { createFileRoute } from '@tanstack/react-router'
import { getRiderPortalFn } from '#/server/operations/operations.functions'
import { RiderEarnings } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/earnings')({
  loader: async () => {
    return getRiderPortalFn()
  },
  component: RiderEarningsPage,
})

function RiderEarningsPage() {
  const data = Route.useLoaderData()
  return <RiderEarnings rider={data.rider} orders={data.orders} />
}
