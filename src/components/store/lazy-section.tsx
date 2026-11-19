import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export interface LazySectionProps {
  children: ReactNode
  className?: string
}

/**
 * Defers offscreen rendering without removing content from the SSR HTML.
 *
 * The intrinsic sizes are the measured heights of the homepage reviews
 * section (three cards) at each Tailwind breakpoint:
 *   <640px: 1100 (measured at 360px)  |  640px: 1163  |  768px: 672
 *   1024px: 596  |  1280px: 568
 *
 * The `auto` keyword lets the browser remember the real rendered size after
 * the first paint, so later scrolls do not shift layout.
 */
export function LazySection({ children, className }: LazySectionProps) {
  return (
    <div
      className={cn(
        '[content-visibility:auto] [contain-intrinsic-size:auto_1100px] sm:[contain-intrinsic-size:auto_1163px] md:[contain-intrinsic-size:auto_672px] lg:[contain-intrinsic-size:auto_596px] xl:[contain-intrinsic-size:auto_568px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
