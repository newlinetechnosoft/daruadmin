import { createFileRoute } from '@tanstack/react-router'
import { getRiderPortalFn } from '#/server/operations/operations.functions'
import { RiderProfile } from '#/components/panels/rider'

export const Route = createFileRoute('/rider/profile')({
  loader: async () => {
    return getRiderPortalFn()
  },
  component: RiderProfilePage,
})

function RiderProfilePage() {
  const data = Route.useLoaderData()
  return <RiderProfile rider={data.rider} />
}
