import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { PaymentsPanel } from '#/components/panels/payments'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/payments')({
  beforeLoad: guardModule('payments'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.payments())
  },
  component: PaymentsPanel,
})
