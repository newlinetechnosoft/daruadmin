import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPanel } from '#/components/panels/customer/favorites-panel'
import { FavoritesGridSkeleton } from '#/components/store/skeletons'

export const Route = createFileRoute('/favorites')({
  pendingComponent: FavoritesGridSkeleton,
  component: FavoritesPage,
})

function FavoritesPage() {
  return <FavoritesPanel />
}
