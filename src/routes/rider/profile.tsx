import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { riderQueries } from '#/queries/rider'
import { RiderProfile } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/profile')({
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(riderQueries.portal())
  },
  component: RiderProfilePage,
})

function RiderProfilePage() {
  const { data } = useSuspenseQuery(riderQueries.portal())
  return <RiderProfile rider={data.rider} />
}
