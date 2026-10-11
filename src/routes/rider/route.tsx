import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMyAccessFn } from '#/server/operations/operations.functions'
import { RiderLayout } from '#/components/panels/rider'

export const Route = createFileRoute('/rider')({
  beforeLoad: async ({ location }) => {
    const access = await getMyAccessFn()
    if (!access.authenticated || !access.user) {
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
