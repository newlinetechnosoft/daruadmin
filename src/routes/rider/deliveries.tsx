import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { riderQueries } from '#/queries/rider'
import { RiderDeliveries } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/deliveries')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(riderQueries.portal())
  },
  component: RiderDeliveriesPage,
})

function RiderDeliveriesPage() {
  const { data } = useSuspenseQuery(riderQueries.portal())
  return <RiderDeliveries orders={data.orders} />
}
