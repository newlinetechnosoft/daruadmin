import * as React from 'react'
import { Skeleton } from '#/components/ui/skeleton'

/**
 * Shared accessible wrapper providing aria-busy, aria-live, and screen-reader status.
 */
function SkeletonRegion({
  children,
  className = '',
  label = 'Loading...',
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/**
 * Category Chips / Pills skeleton for catalog filter bars.
 */
export function CategoryChipsSkeleton({ count = 6 }: { count?: number }) {
  const widths = ['w-20', 'w-24', 'w-16', 'w-28', 'w-22', 'w-18']
  return (
    <SkeletonRegion
      label="Loading categories..."
      className="flex items-center gap-2 overflow-hidden py-1"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-8 ${widths[i % widths.length]} rounded-full shrink-0`}
        />
      ))}
    </SkeletonRegion>
  )
}

/**
 * Hero Banner skeleton matching the responsive hero section.
 */
export function HeroBannerSkeleton() {
  return (
    <SkeletonRegion
      label="Loading banner..."
      className="relative w-full aspect-[16/9] sm:aspect-[21/9] min-h-[220px] sm:min-h-[340px] rounded-2xl sm:rounded-3xl overflow-hidden bg-muted/30"
    >
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 space-y-3">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-10 sm:h-12 w-3/4 max-w-lg rounded-xl" />
        <Skeleton className="h-4 w-1/2 max-w-sm rounded-md" />
        <div className="pt-2 flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </SkeletonRegion>
  )
}

/**
 * Product Card skeleton matching ProductCard layout.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 space-y-3 shadow-xs">
      <div className="relative aspect-square w-full rounded-xl bg-muted/40 overflow-hidden">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Product Rail / Grid skeleton.
 */
export function ProductRailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRegion
      label="Loading products..."
      className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4 lg:gap-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </SkeletonRegion>
  )
}

/**
 * Cart Sheet line items skeleton.
 */
export function CartSheetItemsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonRegion
      label="Loading cart items..."
      className="space-y-4 p-4 divide-y divide-border/60"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 pt-4 first:pt-0">
          <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/**
 * Single Order Card skeleton matching CustomerOrdersPanel.
 */
export function OrderItemSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-3.5 w-28 rounded-md" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <Skeleton className="h-5 w-28 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/**
 * Order List skeleton for orders.tsx.
 */
export function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonRegion
      label="Loading your orders..."
      className="space-y-4 max-w-4xl mx-auto"
    >
      {Array.from({ length: count }).map((_, i) => (
        <OrderItemSkeleton key={i} />
      ))}
    </SkeletonRegion>
  )
}

/**
 * Track Order Timeline skeleton matching track.$code.tsx and track.index.tsx.
 */
export function TrackOrderSkeleton() {
  return (
    <SkeletonRegion
      label="Loading order tracking..."
      className="max-w-3xl mx-auto space-y-6 py-4"
    >
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
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
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
  )
}

/**
 * Favorites page grid skeleton.
 */
export function FavoritesGridSkeleton() {
  return (
    <SkeletonRegion
      label="Loading favorites..."
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <ProductRailSkeleton count={6} />
    </SkeletonRegion>
  )
}

/**
 * Offer page skeleton matching offers.$slug.tsx.
 */
export function OfferPageSkeleton() {
  return (
    <SkeletonRegion
      label="Loading offer details..."
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8"
    >
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
        <Skeleton className="h-6 w-44 rounded-md" />
        <ProductRailSkeleton count={4} />
      </div>
    </SkeletonRegion>
  )
}

/**
 * Reviews section skeleton matching Homepage reviews layout.
 */
export function ReviewsSectionSkeleton() {
  return (
    <SkeletonRegion
      label="Loading customer reviews..."
      className="grid gap-4 md:grid-cols-3 py-4"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[250px] flex-col justify-between rounded-2xl border border-border bg-card p-6 sm:p-7 space-y-4"
        >
          <div className="space-y-3">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-5 w-full rounded-md" />
            <Skeleton className="h-5 w-4/5 rounded-md" />
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-border/60">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-36 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}
