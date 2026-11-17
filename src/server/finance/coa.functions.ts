import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import {
  createAccountQuery,
  deleteAccountQuery,
  getChartOfAccountsTreeQuery,
  updateAccountQuery,
} from './coa.queries'

export const getChartOfAccountsTreeFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getChartOfAccountsTreeQuery()
  },
)

export const createAccountFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().optional(),
        name: z.string().min(2),
        rootType: z
          .enum(['asset', 'liability', 'equity', 'income', 'expense'])
          .optional(),
        parentId: z.string().nullable().optional(),
        isGroup: z.boolean().default(false),
        accountType: z.string().nullable().optional(),
        balanceMustBe: z.enum(['debit', 'credit']).nullable().optional(),
        currency: z.string().default('NPR'),
        description: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const result = await createAccountQuery(data)

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Created chart of accounts entry: ${result.name} (${result.code})`,
    )

    return result
  })

export const updateAccountFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(2).optional(),
        description: z.string().nullable().optional(),
        accountType: z.string().nullable().optional(),
        balanceMustBe: z.enum(['debit', 'credit']).nullable().optional(),
        isFrozen: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await updateAccountQuery(data)

    await logAudit(
      user.name,
      'accounts',
      'edit',
      `Updated account ${data.id} properties/status`,
    )

    return result
  })

export const deleteAccountFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await deleteAccountQuery(data.id)

    await logAudit(
      user.name,
      'accounts',
      'delete',
      `Deleted account ${data.id}`,
    )

    return result
  })
