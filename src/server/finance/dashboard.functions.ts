import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission } from '#/server/auth/permissions'
import { getAccountingDashboardQuery } from './dashboard.queries'

export const getAccountingDashboardFn = createServerFn({ method: 'GET' })
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

    return getAccountingDashboardQuery({
      branchId: data?.branchId,
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
    })
  })
