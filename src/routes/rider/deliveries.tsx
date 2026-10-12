import { createFileRoute } from '@tanstack/react-router'
import { riderQueries } from '#/queries/rider'
import { RiderDeliveries } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/deliveries')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(riderQueries.portal())
  },
  component: RiderDeliveriesPage,
})

function RiderDeliveriesPage() {
  const data = Route.useLoaderData()
  return <RiderDeliveries orders={data.orders} />
}
