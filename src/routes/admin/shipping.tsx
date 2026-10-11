import { createFileRoute } from '@tanstack/react-router'
import { getShippingFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { ShippingPanel } from '#/components/panels/shipping'

export const Route = createFileRoute('/admin/shipping')({
  beforeLoad: guardModule('shipping'),
  loader: async () => {
    return getShippingFn()
  },
  component: ShippingPanel,
})
