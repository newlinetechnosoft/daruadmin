import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import {
  approveExpenseQuery,
  createExpenseCategoryQuery,
  createExpenseQuery,
  getExpenseCategoriesQuery,
  getExpenseDetailsQuery,
  getExpensesQuery,
  payExpenseQuery,
  rejectExpenseQuery,
} from './expenses.queries'

export const getExpenseCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getExpenseCategoriesQuery()
  },
)

export const getExpensesFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        branchId: z.string().optional(),
        categoryId: z.string().optional(),
        categoryAccountId: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getExpensesQuery({
      search: data?.search,
      status: data?.status,
      branchId: data?.branchId,
      categoryId: data?.categoryId,
      categoryAccountId: data?.categoryAccountId,
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
      limit: data?.limit,
      offset: data?.offset,
    })
  })

export const getExpenseDetailsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ expenseId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getExpenseDetailsQuery(data.expenseId)
  })

export const createExpenseFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        categoryAccountId: z.string().min(1),
        amountInRs: z.number().positive(),
        taxAmountInRs: z.number().min(0).default(0),
        expenseDate: z.string().optional(),
        vendorName: z.string().optional(),
        vendorPan: z.string().optional(),
        branchId: z.string().optional(),
        costCenterId: z.string().optional(),
        paymentMethod: z.string().default('cash'),
        paymentReference: z.string().optional(),
        receiptUrls: z.array(z.string()).default([]),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const result = await createExpenseQuery({
      categoryAccountId: data.categoryAccountId,
      amount: Math.round(data.amountInRs * 100),
      taxAmount: Math.round(data.taxAmountInRs * 100),
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      vendorName: data.vendorName,
      vendorPan: data.vendorPan,
      branchId: data.branchId,
      costCenterId: data.costCenterId,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      receiptUrls: data.receiptUrls,
      notes: data.notes,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Submitted expense claim ${result.expenseNumber}: Rs. ${data.amountInRs}`,
    )

    return result
  })

export const approveExpenseFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ expenseId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await approveExpenseQuery(data.expenseId, user)

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Approved expense claim ${data.expenseId}`,
    )

    return result
  })

export const rejectExpenseFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        expenseId: z.string().min(1),
        reason: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await rejectExpenseQuery({
      expenseId: data.expenseId,
      reason: data.reason,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Rejected expense claim ${data.expenseId}${data.reason ? `: ${data.reason}` : ''}`,
    )

    return result
  })

export const payExpenseFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        expenseId: z.string().min(1),
        paymentAccountId: z.string().min(1),
        paymentMethod: z.string().optional(),
        paymentReference: z.string().optional(),
        tdsAmountInRs: z.number().min(0).optional(),
        postingDate: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await payExpenseQuery({
      expenseId: data.expenseId,
      paymentAccountId: data.paymentAccountId,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      tdsAmount: data.tdsAmountInRs ? Math.round(data.tdsAmountInRs * 100) : 0,
      postingDate: data.postingDate ? new Date(data.postingDate) : undefined,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Disbursed payment for expense ${data.expenseId}${result.voucherNo ? ` (${result.voucherNo})` : ''}`,
    )

    return result
  })

export const createExpenseCategoryFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        defaultAccountId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')
    const result = await createExpenseCategoryQuery(data)
    await logAudit(
      user.name,
      'accounts',
      'create',
      `Created expense category ${result.name}`,
    )
    return result
  })

export const submitExpenseFn = createExpenseFn
