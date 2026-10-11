import { createFileRoute } from '@tanstack/react-router'
import { getInventoryOpsFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { InventoryPanel } from '#/components/panels/inventory'

export const Route = createFileRoute('/admin/inventory')({
  beforeLoad: guardModule('products'),
  loader: async () => {
    return getInventoryOpsFn()
  },
  component: InventoryPanel,
})
