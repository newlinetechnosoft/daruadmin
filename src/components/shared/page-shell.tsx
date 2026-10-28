import * as React from 'react'
import { cn } from '#/lib/utils'
import { PageHeader } from './page-header'

export { PageHeader }

export interface PageShellProps {
  children: React.ReactNode
  className?: string
  fullWidth?: boolean
}

/**
 * Standard page frame for Mezmani ERP Desk.
 * Enforces responsive padding, zero horizontal scroll, and max-width 1440px on large displays.
 */
export function PageShell({
  children,
  className,
  fullWidth = false,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 space-y-6',
        !fullWidth && 'max-w-7xl mx-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}
