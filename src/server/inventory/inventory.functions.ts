import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import {
  upsertDealerSchema,
  deleteDealerSchema,
  assignDealerItemsSchema,
  assignItemDealersSchema,
} from './inventory.schemas'
import {
  getAllDealersQuery,
  getDealerByIdQuery,
  upsertDealerQuery,
  deleteDealerQuery,
  assignDealerItemsQuery,
  assignItemDealersQuery,
  getDealersByItemQuery,
  getAdminDealersWithCatalogQuery,
  getRecentStockMovementsQuery,
} from './inventory.queries'

export const getAdminDealersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('dealers', 'view')
    return getAdminDealersWithCatalogQuery()
  },
)

export const getAllDealersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('dealers', 'view')
    return getAllDealersQuery()
  },
)

export const getDealerByIdFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission('dealers', 'view')
    return getDealerByIdQuery(data.id)
  })

export const upsertDealerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertDealerSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('dealers', action)
    const result = await upsertDealerQuery(data)
    await logAudit(
      user.name,
      'dealers',
      action,
      `${action === 'create' ? 'Registered' : 'Updated'} dealer: ${data.name} (Contact: ${data.contact})`,
    )
    return result
  })

export const deleteDealerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => deleteDealerSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('dealers', 'delete')
    const result = await deleteDealerQuery(data.id)
    await logAudit(
      user.name,
      'dealers',
      'delete',
      `Deleted dealer ID: ${data.id}`,
    )
    return result
  })

export const assignDealerItemsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => assignDealerItemsSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('dealers', 'edit')
    const result = await assignDealerItemsQuery(data)
    await logAudit(
      user.name,
      'dealers',
      'edit',
      `Updated assigned items for dealer ${data.dealerId} (${data.items.length} items)`,
    )
    return result
  })

export const assignItemDealersFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => assignItemDealersSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('dealers', 'edit')
    const result = await assignItemDealersQuery(data)
    await logAudit(
      user.name,
      'dealers',
      'edit',
      `Updated assigned dealers for ${data.catalogType} item ${data.productId} (${data.dealerIds.length} dealers)`,
    )
    return result
  })

export const getDealersByItemFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        catalogType: z.enum(['liquor', 'grocery']),
        productId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('dealers', 'view')
    return getDealersByItemQuery(data.catalogType, data.productId)
  })

export const getRecentStockMovementsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ limit: z.number().optional().default(100) }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission('inventory', 'view')
    return getRecentStockMovementsQuery(data.limit)
  })
