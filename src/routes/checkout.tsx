import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMyAccessFn } from '#/server/operations/operations.functions'
import { CheckoutPanel } from '#/components/panels/customer/checkout-panel'

export const Route = createFileRoute('/checkout')({
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
  },
  component: CheckoutPage,
})

function CheckoutPage() {
  return <CheckoutPanel />
}
