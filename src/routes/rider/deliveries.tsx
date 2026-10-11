import { createFileRoute } from '@tanstack/react-router'
import { getRiderPortalFn } from '#/server/operations/operations.functions'
import { RiderDeliveries } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/deliveries')({
  loader: async () => {
    return getRiderPortalFn()
  },
  component: RiderDeliveriesPage,
})

function RiderDeliveriesPage() {
  const data = Route.useLoaderData()
  return <RiderDeliveries orders={data.orders} />
}
