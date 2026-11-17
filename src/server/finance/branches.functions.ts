import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import { dbTx } from '#/db'
import { postInterBranchTransferTx } from './double-entry'
import {
  createBranchQuery,
  getBranchesQuery,
  getBranchProfitabilityQuery,
  updateBranchQuery,
} from './branches.queries'

export const getBranchesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getBranchesQuery()
  },
)

export const createBranchFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().min(2).max(10),
        name: z.string().min(2),
        city: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        isHeadOffice: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const result = await createBranchQuery(data)

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Created company branch: ${result.name} (${result.code})`,
    )

    return result
  })

export const updateBranchFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(2).optional(),
        city: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        isHeadOffice: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await updateBranchQuery(data)

    await logAudit(
      user.name,
      'accounts',
      'edit',
      `Updated company branch ${data.id}`,
    )

    return result
  })

export const getBranchProfitabilityFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        branchId: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getBranchProfitabilityQuery({
      branchId: data?.branchId,
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
    })
  })

/**
 * Executes a double-entry inter-branch fund transfer between company branches.
 */
export const recordInterBranchTransferFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        fromBranchId: z.string().min(1),
        toBranchId: z.string().min(1),
        fromAccountId: z.string().min(1),
        toAccountId: z.string().min(1),
        amountInRs: z.number().positive(),
        narration: z.string().optional(),
        postingDate: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const allBranches = await getBranchesQuery()
    const fromBranch = allBranches.find((b) => b.id === data.fromBranchId)
    const toBranch = allBranches.find((b) => b.id === data.toBranchId)

    if (!fromBranch) throw new Error(`Source branch ${data.fromBranchId} not found.`)
    if (!toBranch) throw new Error(`Destination branch ${data.toBranchId} not found.`)

    const amount = Math.round(data.amountInRs * 100)

    const result = await dbTx.transaction(async (tx) => {
      return postInterBranchTransferTx(tx, {
        fromBranchId: fromBranch.id,
        fromBranchName: fromBranch.name,
        toBranchId: toBranch.id,
        toBranchName: toBranch.name,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount,
        narration: data.narration,
        postingDate: data.postingDate ? new Date(data.postingDate) : undefined,
        actor: user,
      })
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Inter-branch transfer ${result.voucherNo}: Transferred Rs. ${data.amountInRs} from ${fromBranch.name} to ${toBranch.name}`,
    )

    return result
  })
