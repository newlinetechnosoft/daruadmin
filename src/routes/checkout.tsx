import { createFileRoute, redirect } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { CheckoutPanel } from '#/components/panels/customer/checkout-panel'
import { CheckoutPageSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/checkout')({
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
    if (access.user.role === 'customer' && !access.user.phoneVerified) {
      throw redirect({
        to: '/verify-phone',
        search: {
          phone: access.user.phone || '',
          redirect: location.pathname,
        },
      })
    }
  },
  pendingComponent: CheckoutPageSkeleton,
  component: CheckoutPage,
})

function CheckoutPage() {
  return <CheckoutPanel />
}
