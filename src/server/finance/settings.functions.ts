import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission } from '#/server/auth/permissions'
import {
  getAccountingConfigurationQuery,
  updateVoucherSequencePrefixQuery,
} from './settings.queries'

export const getAccountingConfigurationFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requirePermission('accounts', 'view')
    return getAccountingConfigurationQuery()
  })

export const updateVoucherSequencePrefixFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        fiscalYearId: z.string(),
        voucherType: z.string(),
        prefix: z.string().min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'edit')
    return updateVoucherSequencePrefixQuery(
      data.fiscalYearId,
      data.voucherType,
      data.prefix,
    )
  })
