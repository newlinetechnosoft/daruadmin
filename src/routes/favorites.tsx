import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPanel } from '#/components/panels/customer/favorites-panel'
import { CatalogPageSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/favorites')({
  pendingComponent: CatalogPageSkeleton,
  component: FavoritesPage,
})

function FavoritesPage() {
  return <FavoritesPanel />
}
