import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { RiderLayout } from '#/components/panels/rider'

export const Route = createFileRoute('/rider')({
  beforeLoad: async ({ location, context }) => {
    const access = await context.queryClient.ensureQueryData(
      adminQueries.access(),
    )
    if (!access.authenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    if (!access.user.isActive || access.user.banned) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    if (access.user.role !== 'rider' && access.user.role !== 'admin') {
      throw redirect({ to: '/' })
    }
    return {
      user: access.user,
    }
  },
  component: RiderLayout,
})
