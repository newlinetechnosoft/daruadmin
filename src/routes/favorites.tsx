import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPanel } from '#/components/panels/customer/favorites-panel'

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
})

function FavoritesPage() {
  return <FavoritesPanel />
}
