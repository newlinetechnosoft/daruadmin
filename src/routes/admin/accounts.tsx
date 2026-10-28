import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { guardModule } from '#/server/auth/guards'
import { AccountsPanel } from '#/components/panels/accounts'
import { adminQueries } from '#/queries/admin'

const accountsSearchSchema = z.object({
  tab: z
    .enum([
      'ledger',
      'transactions',
      'dealer-ledger',
      'sales-account',
      'salary-account',
      'chart-of-accounts',
      'financial-reports',
    ])
    .optional(),
  account: z.string().optional(),
  voucherType: z.string().optional(),
  partyType: z.string().optional(),
  partyId: z.string().optional(),
})

export const Route = createFileRoute('/admin/accounts')({
  validateSearch: (s) => accountsSearchSchema.parse(s),
  beforeLoad: guardModule('accounts'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.ledger())
  },
  component: AccountsPanel,
})
