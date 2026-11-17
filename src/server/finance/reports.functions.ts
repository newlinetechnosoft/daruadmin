import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission } from '#/server/auth/permissions'
import {
  getAccountingIntegrityAuditQuery,
  getAgingReportQuery,
  getBalanceSheetReportQuery,
  getCashFlowStatementReportQuery,
  getDayBookReportQuery,
  getProfitAndLossReportQuery,
  getTaxSummaryReportQuery,
  getTrialBalanceReportQuery,
} from './reports.queries'

export const getTrialBalanceReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        branchId: z.string().optional(),
        costCenterId: z.string().optional(),
        includeZero: z.boolean().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getTrialBalanceReportQuery({
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
      branchId: data?.branchId,
      costCenterId: data?.costCenterId,
      includeZero: data?.includeZero,
    })
  })

export const getProfitAndLossReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        branchId: z.string().optional(),
        costCenterId: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getProfitAndLossReportQuery({
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
      branchId: data?.branchId,
      costCenterId: data?.costCenterId,
    })
  })

export const getBalanceSheetReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        asOfDate: z.string().optional(),
        branchId: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getBalanceSheetReportQuery({
      asOfDate: data?.asOfDate ? new Date(data.asOfDate) : undefined,
      branchId: data?.branchId,
    })
  })

export const getCashFlowStatementReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        branchId: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getCashFlowStatementReportQuery({
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
      branchId: data?.branchId,
    })
  })

export const getTaxSummaryReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getTaxSummaryReportQuery({
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
    })
  })

export const getDayBookReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        date: z.string().optional(),
        branchId: z.string().optional(),
        voucherType: z.string().optional(),
        limit: z.number().optional().default(200),
        offset: z.number().optional().default(0),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getDayBookReportQuery({
      date: data?.date ? new Date(data.date) : undefined,
      branchId: data?.branchId,
      voucherType: data?.voucherType,
      limit: data?.limit,
      offset: data?.offset,
    })
  })

export const getAgingReportFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        type: z.enum(['receivable', 'payable']).optional().default('payable'),
        asOfDate: z.string().optional(),
        branchId: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getAgingReportQuery({
      type: data?.type,
      asOfDate: data?.asOfDate ? new Date(data.asOfDate) : undefined,
      branchId: data?.branchId,
    })
  })

export const getAccountingIntegrityAuditFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requirePermission('accounts', 'view')
  return getAccountingIntegrityAuditQuery()
})

export const getSubLedgerIntegrityAuditFn = getAccountingIntegrityAuditFn
