import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useFavorites } from '#/lib/favorites'
import { getProductsByIdsFn } from '#/server/catalog/catalog.functions'
import { ProductCard } from '#/components/store/product-card'
import type { ProductProps } from '#/components/store/product-card'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/shared/empty-state'
import { Heart, Trash2, ArrowRight, Loader2 } from 'lucide-react'

/**
 * CUSTOMER FAVORITES PANEL
 *
 * Displays locally favorited items from IndexedDB.
 * Fetches products in ONE batched query (getProductsByIdsFn) and purges
 * any stale/deleted product IDs locally.
 *
 * NOTE: As designed, this is purely client-side local storage and does not
 * sync with the user account on the server.
 */
export function FavoritesPanel() {
  const { favoriteIds, clearAllFavorites, cleanupFavorites, isHydrated } =
    useFavorites()
  const [products, setProducts] = useState<ProductProps[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const favKey = favoriteIds.join(',')

  useEffect(() => {
    if (!isHydrated) return

    if (favoriteIds.length === 0) {
      setProducts([])
      return
    }

    let isMounted = true
    setIsLoading(true)

    getProductsByIdsFn({
      data: { ids: Array.from(favoriteIds) },
    })
      .then((data) => {
        if (!isMounted) return
        const castData = data as ProductProps[]
        setProducts(castData)

        // Clean up any stale or inactive product IDs from local IndexedDB
        const activeIds = new Set(castData.map((p) => p.id))
        const stale = favoriteIds.filter((id) => !activeIds.has(id))
        if (stale.length > 0) {
          cleanupFavorites(stale)
        }
      })
      .catch((err) => {
        console.warn('[FavoritesPanel] Failed to fetch favorited products:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [favKey, isHydrated, cleanupFavorites])

  // Filter out products that were removed from favorites in current view
  const visibleProducts = products.filter((p) => favoriteIds.includes(p.id))

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Banner / Heading */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Heart className="h-4 w-4 fill-primary" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  My Favorites
                </h1>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Your saved drinks and late-night essentials stored on this device.
              </p>
            </div>

            {visibleProducts.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllFavorites}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 self-start sm:self-auto cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all favorites
              </Button>
            )}
          </div>

          {/* Content Area */}
          <div className="pt-8">
            {isLoading && visibleProducts.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : visibleProducts.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="Your favorites list is empty"
                description="Tap the heart icon on any drink or snack to quickly access them here next time."
                action={
                  <Button asChild size="sm" className="gap-2 text-xs">
                    <Link to="/drinks">
                      Explore drinks catalog
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
