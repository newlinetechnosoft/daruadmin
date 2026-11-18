import { Skeleton } from '#/components/ui/skeleton'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden',
        className,
      )}
    >
      <div className="h-10 bg-muted/40 border-b border-border flex items-center px-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-12 flex items-center px-4 gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1 max-w-[120px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsSkeleton({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 sm:p-5 shadow-none border-border">
          <CardContent className="p-0 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-4 rounded-full" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function CardSkeleton({
  count = 3,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 shadow-none border-border">
          <CardContent className="p-0 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * ProductCardSkeleton accurately mirrors ProductCard layout
 * to eliminate Cumulative Layout Shift (CLS) during catalog fetches.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between overflow-hidden bg-card border border-border/80 rounded-xl sm:rounded-2xl p-0',
        className,
      )}
    >
      <div className="relative aspect-square w-full bg-muted/40 dark:bg-zinc-900/40 flex items-center justify-center p-3">
        <Skeleton className="w-3/4 h-3/4 rounded-lg" />
      </div>
      <div className="p-2 sm:p-3.5 space-y-2 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-4.5 w-4/5" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/**
 * ProductGridSkeleton renders a responsive grid of card skeletons.
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3.5 md:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * CatalogPageSkeleton provides a full skeleton for /drinks, /food, /grocery, /ddc.
 */
export function CatalogPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header bar placeholder */}
      <div className="h-16 border-b border-border bg-card/50 flex items-center px-4 sm:px-8 justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-4 w-40 hidden sm:block" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48 rounded-lg hidden md:block" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Breadcrumb + Title */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-36" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Skeleton className="h-8 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </div>

        {/* Sidebar + Product Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] lg:gap-8 xl:grid-cols-[240px_1fr]">
          <aside className="hidden md:block space-y-5">
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2.5 pt-4 border-t border-border">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section>
            <ProductGridSkeleton count={6} />
          </section>
        </div>
      </main>
    </div>
  )
}

/**
 * LandingPageSkeleton displays an instant layout placeholder for the homepage.
 */
export function LandingPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header bar placeholder */}
      <div className="h-16 border-b border-border bg-card/50 flex items-center px-4 sm:px-8 justify-between">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-64 rounded-lg hidden md:block" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      <main className="space-y-12 pb-16">
        {/* Hero Slider Skeleton */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
          <Skeleton className="h-64 sm:h-80 md:h-96 w-full rounded-2xl" />
        </div>

        {/* Categories Bento Grid Skeleton */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex justify-between items-end">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-64" />
            </div>
            <Skeleton className="h-4 w-24 hidden sm:block" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 sm:h-44 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Food Slider Skeleton */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Reviews Section Skeleton */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-7 w-56" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-6">
                <CardContent className="p-0 space-y-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-16 w-full" />
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * CheckoutPageSkeleton mirrors checkout flow layout.
 */
export function CheckoutPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-card/50 flex items-center px-4 sm:px-8 justify-between">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-44" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <Card className="p-5">
              <CardContent className="p-0 space-y-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card className="p-5">
              <CardContent className="p-0 space-y-4">
                <Skeleton className="h-5 w-44" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3.5 rounded-2xl border border-border/60 p-4"
                    >
                      <Skeleton className="size-14 rounded-2xl shrink-0" />
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-4 w-20 rounded-full" />
                      </div>
                      <Skeleton className="size-6 rounded-full shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card className="p-5 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * OrdersPageSkeleton mirrors order history panel.
 */
export function OrdersPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-card/50 flex items-center px-4 sm:px-8 justify-between">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <CardContent className="p-0 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

/**
 * VoucherSkeleton mirrors settlement voucher print document.
 */
export function VoucherSkeleton() {
  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="mx-auto max-w-3xl bg-card border border-border rounded-xl p-8 space-y-6 shadow-sm">
        <div className="text-center space-y-2 pb-4 border-b border-border">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-3.5 w-40 mx-auto" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <TableSkeleton rows={4} columns={4} />
        <div className="flex justify-between items-center pt-6 border-t border-border">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 w-32" />
        </div>
      </div>
    </div>
  )
}

/**
 * AdminLayoutSkeleton mirrors admin layout navigation and content area.
 */
export function AdminLayoutSkeleton() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar skeleton */}
      <aside className="w-64 border-r border-border bg-sidebar p-4 space-y-4 hidden md:flex flex-col">
        <div className="flex items-center gap-2 pb-2 border-b border-sidebar-border">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2 flex-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/40 shrink-0">
          <Skeleton className="h-6 w-36" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <main className="p-6 space-y-6">
          <StatsSkeleton count={4} />
          <TableSkeleton rows={6} columns={5} />
        </main>
      </div>
    </div>
  )
}
