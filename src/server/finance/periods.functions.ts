import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import {
  carryForwardOpeningBalancesQuery,
  generateBsPeriodsForFiscalYearQuery,
  getAccountingPeriodsQuery,
  getPeriodClosingHistoryQuery,
  lockAccountingPeriodQuery,
  postYearEndClosingVoucherQuery,
  unlockAccountingPeriodQuery,
  verifyFiscalYearPreCloseQuery,
} from './periods.queries'

export const getAccountingPeriodsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ fiscalYearId: z.string().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getAccountingPeriodsQuery(data?.fiscalYearId)
  })

export const generateBsPeriodsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ fiscalYearId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await generateBsPeriodsForFiscalYearQuery(data.fiscalYearId)

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Generated 12 BS accounting periods for fiscal year ${data.fiscalYearId}`,
    )

    return result
  })

export const generateFiscalYearPeriodsFn = generateBsPeriodsFn

export const lockAccountingPeriodFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ periodId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await lockAccountingPeriodQuery(data.periodId, user)

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Locked BS accounting period ${data.periodId}`,
    )

    return result
  })

export const unlockAccountingPeriodFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ periodId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await unlockAccountingPeriodQuery(data.periodId)

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Unlocked BS accounting period ${data.periodId}`,
    )

    return result
  })

export const togglePeriodLockFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ periodId: z.string().min(1), status: z.enum(['open', 'closed']) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.status === 'closed') {
      return lockAccountingPeriodFn({ data: { periodId: data.periodId } })
    } else {
      return unlockAccountingPeriodFn({ data: { periodId: data.periodId } })
    }
  })

export const postYearEndClosingVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        fiscalYearId: z.string().min(1),
        narration: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await postYearEndClosingVoucherQuery({
      fiscalYearId: data.fiscalYearId,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Posted Fiscal Year closing voucher ${result.voucherNo} for FY ${data.fiscalYearId} (Net profit/loss: Rs. ${(result.netProfitOrLoss / 100).toFixed(2)})`,
    )

    return result
  })

export const executePeriodClosingVoucherFn = postYearEndClosingVoucherFn

export const verifyFiscalYearPreCloseFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ fiscalYearId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return verifyFiscalYearPreCloseQuery(data.fiscalYearId)
  })

export const getPeriodClosingHistoryFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requirePermission('accounts', 'view')
    return getPeriodClosingHistoryQuery()
  })

export const carryForwardOpeningBalancesFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        fromFiscalYearId: z.string().min(1),
        toFiscalYearId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await carryForwardOpeningBalancesQuery({
      fromFiscalYearId: data.fromFiscalYearId,
      toFiscalYearId: data.toFiscalYearId,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Carried forward opening balance voucher ${result.voucherNo} from FY ${data.fromFiscalYearId} to FY ${data.toFiscalYearId} (${result.lineCount} accounts, Rs. ${(result.totalAssetDebit / 100).toFixed(2)})`,
    )

    return result
  })
