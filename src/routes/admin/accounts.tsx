import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { guardModule } from '#/server/auth/guards'
import { AccountsPanel } from '#/components/panels/accounts'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

const accountsSearchSchema = z.object({
  tab: z
    .enum([
      'overview',
      'chart-of-accounts',
      'branches',
      'ledger',
      'vouchers',
      'party-accounts',
      'dealer-ledger',
      'rider-ledger',
      'customer-ledger',
      'supplier-ledger',
      'employee-ledger',
      'bank-cash',
      'expenses',
      'reconciliation',
      'financial-reports',
      'export-center',
      'period-close',
      'audit-trail',
      'settings',
      'transactions',
      'sales-account',
      'salary-account',
      'account-defaults',
    ])
    .optional(),
  account: z.string().optional(),
  voucherType: z.string().optional(),
  partyType: z.string().optional(),
  partyId: z.string().optional(),
  branchId: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const Route = createFileRoute('/admin/accounts')({
  validateSearch: (s) => accountsSearchSchema.parse(s),
  beforeLoad: guardModule('accounts'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.ledger())
  },
  pendingComponent: () => <AdminContentSkeleton variant="stats-table" />,
  component: AccountsPanel,
})
