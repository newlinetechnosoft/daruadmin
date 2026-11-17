import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission } from '#/server/auth/permissions'
import { getPartiesSummaryQuery } from './parties.queries'

export const getPartiesSummaryFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        partyType: z.enum(['dealer', 'rider', 'customer', 'supplier', 'employee']),
        search: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getPartiesSummaryQuery({
      partyType: data.partyType,
      search: data.search,
      limit: data.limit,
      offset: data.offset,
    })
  })

export const getPartyAccountsSummaryFn = getPartiesSummaryFn
