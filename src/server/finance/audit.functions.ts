import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission } from '#/server/auth/permissions'
import {
  getExportAuditLogsQuery,
  getFinancialAuditLogsQuery,
  getReversalHistoryQuery,
  getVoucherApprovalLogsQuery,
} from './audit.queries'

export const getFinancialAuditLogsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        action: z.string().optional(),
        actor: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getFinancialAuditLogsQuery(data)
  })

export const getVoucherApprovalLogsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ limit: z.number().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getVoucherApprovalLogsQuery(data)
  })

export const getReversalHistoryFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getReversalHistoryQuery()
  },
)

export const getExportAuditLogsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getExportAuditLogsQuery()
  },
)
