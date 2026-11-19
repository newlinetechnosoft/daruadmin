import type { ReactNode } from 'react'
import { Skeleton } from '#/components/ui/skeleton'
import { ProductGridSkeleton } from '#/components/shared/loading'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'

/**
 * Shared accessible wrapper. `role="status"` is enough for assistive tech to
 * announce the single sr-only label; `aria-live` is intentionally omitted to
 * avoid duplicate announcements when several skeletons mount together.
 */
function SkeletonRegion({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}

/**
 * Track Order page skeleton matching the real Header / main / Footer shell.
 */
export function TrackOrderSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <SkeletonRegion className="space-y-6">
          {/* Page title & search */}
          <div className="text-center max-w-xl mx-auto mb-8 space-y-3">
            <Skeleton className="h-6 w-36 mx-auto rounded-full" />
            <Skeleton className="h-8 w-56 mx-auto rounded-lg" />
            <Skeleton className="h-4 w-full max-w-md mx-auto rounded-md" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

          {/* Top Header Card */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40 rounded-md" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-4 w-60 rounded-md" />
          </div>

          {/* Stepper Progress */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 flex-1"
                >
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Delivery details card */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        </SkeletonRegion>
      </main>

      <Footer />
    </div>
  )
}

/**
 * Favorites page skeleton matching the real Header / main / Footer shell and
 * product grid.
 */
export function FavoritesGridSkeleton() {
  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SkeletonRegion className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-4 w-72 rounded-md" />
              </div>
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>

            <ProductGridSkeleton count={6} />
          </SkeletonRegion>
        </div>
      </main>

      <Footer />
    </div>
  )
}

/**
 * Offer page skeleton matching offers.$slug.tsx.
 */
export function OfferPageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <SkeletonRegion className="space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-4 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>

          <div className="relative rounded-3xl border border-border bg-card p-6 sm:p-10 min-h-[260px] flex flex-col justify-between">
            <div className="space-y-3 max-w-lg">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-10 w-3/4 rounded-xl" />
              <Skeleton className="h-4 w-full rounded-md" />
            </div>
            <div className="pt-4 flex gap-4">
              <Skeleton className="h-10 w-36 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <ProductGridSkeleton count={4} />
          </div>
        </SkeletonRegion>
      </main>

      <Footer />
    </div>
  )
}
