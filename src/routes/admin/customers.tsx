import { createFileRoute } from '@tanstack/react-router'
import { getCustomersOpsFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { CustomersPanel } from '#/components/panels/customers'

export const Route = createFileRoute('/admin/customers')({
  beforeLoad: guardModule('customers'),
  loader: async () => {
    return getCustomersOpsFn()
  },
  component: CustomersPanel,
})
