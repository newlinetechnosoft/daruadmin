import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { InventoryPanel } from '#/components/panels/inventory'
import { adminQueries } from '#/queries/admin'

export const Route = createFileRoute('/admin/inventory')({
  beforeLoad: guardModule('products'),
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(adminQueries.inventory())
  },
  component: InventoryPanel,
})
