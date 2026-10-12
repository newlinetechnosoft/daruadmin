import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { AccountsPanel } from '#/components/panels/accounts'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/accounts')({
  beforeLoad: guardModule('accounts'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.ledger())
  },
  component: AccountsPanel,
})
