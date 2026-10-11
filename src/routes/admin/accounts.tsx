import { createFileRoute } from '@tanstack/react-router'
import { getLedgerFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { AccountsPanel } from '#/components/panels/accounts'

export const Route = createFileRoute('/admin/accounts')({
  beforeLoad: guardModule('accounts'),
  loader: async () => {
    return getLedgerFn()
  },
  component: AccountsPanel,
})
