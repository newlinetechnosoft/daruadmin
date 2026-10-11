import { createFileRoute } from '@tanstack/react-router'
import { getPaymentsFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { PaymentsPanel } from '#/components/panels/payments'

export const Route = createFileRoute('/admin/payments')({
  beforeLoad: guardModule('payments'),
  loader: async () => {
    return getPaymentsFn()
  },
  component: PaymentsPanel,
})
