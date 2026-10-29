import { createServerFn } from '@tanstack/react-start'
import {
  requirePermission,
  logAudit,
} from '#/server/auth/permissions'
import {
  getRecycleBinItemsQuery,
  restoreRecycleBinItemQuery,
  permanentDeleteRecycleBinItemQuery,
  emptyRecycleBinQuery,
} from './recycle-bin.queries'
import {
  restoreRecycleBinSchema,
  permanentDeleteRecycleBinSchema,
} from './recycle-bin.schemas'

export const getRecycleBinFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requirePermission('settings', 'view')
    return getRecycleBinItemsQuery()
  })

export const restoreRecycleBinItemFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => restoreRecycleBinSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('settings', 'edit')
    const result = await restoreRecycleBinItemQuery(data.id)
    await logAudit(
      user.name,
      'settings',
      'edit',
      `Restored ${result.name} (${result.entityType}) from Recycle Bin`,
    )
    return result
  })

export const permanentDeleteRecycleBinItemFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => permanentDeleteRecycleBinSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('settings', 'delete')
    const result = await permanentDeleteRecycleBinItemQuery(data.id)
    await logAudit(
      user.name,
      'settings',
      'delete',
      `Permanently deleted recycle bin item ID: ${data.id}`,
    )
    return result
  })

export const emptyRecycleBinFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { user } = await requirePermission('settings', 'delete')
    const result = await emptyRecycleBinQuery()
    await logAudit(
      user.name,
      'settings',
      'delete',
      'Emptied all items in Recycle Bin',
    )
    return result
  })
