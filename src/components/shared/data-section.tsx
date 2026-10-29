import * as React from 'react'
import { cn } from '#/lib/utils'
import { DataRefreshButton, type DataRefreshButtonProps } from './data-refresh-button'
import type { QueryKey } from '@tanstack/react-query'

export interface DataSectionProps {
  children: React.ReactNode

  /**
   * Whether the section data is currently being fetched or refreshed.
   */
  isRefreshing?: boolean

  /**
   * TanStack Query key(s) to pass to built-in refresh button if showRefreshButton is true.
   */
  queryKeys?: QueryKey | QueryKey[]

  /**
   * Custom refresh callback.
   */
  onRefresh?: () => Promise<void> | void

  /**
   * Optional section title.
   */
  title?: React.ReactNode

  /**
   * Optional section subtitle / description.
   */
  description?: React.ReactNode

  /**
   * Optional record count badge.
   */
  count?: number | string

  /**
   * Optional custom header actions.
   */
  actions?: React.ReactNode

  /**
   * Whether to display the integrated refresh button in the header.
   */
  showRefreshButton?: boolean

  /**
   * Refresh button variant if rendered.
   */
  refreshVariant?: DataRefreshButtonProps['variant']

  /**
   * Container style variant:
   * - 'default': clean container with relative positioning
   * - 'card': card container with border and subtle background
   */
  variant?: 'default' | 'card'

  /**
   * Additional container CSS classes.
   */
  className?: string

  /**
   * Additional content wrapper CSS classes.
   */
  contentClassName?: string
}

export function DataSection({
  children,
  isRefreshing = false,
  queryKeys,
  onRefresh,
  title,
  description,
  count,
  actions,
  showRefreshButton = false,
  refreshVariant = 'toolbar',
  variant = 'default',
  className,
  contentClassName,
}: DataSectionProps) {
  const hasHeader = Boolean(title || description || actions || showRefreshButton)

  return (
    <div
      className={cn(
        'relative w-full min-w-0 transition-all duration-300',
        variant === 'card' && 'rounded-xl border border-border bg-card p-4 shadow-2xs',
        className,
      )}
    >
      {/* Sleek animated top progress bar while refreshing */}
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-20 rounded-t-xl bg-primary/20 pointer-events-none">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-refresh-shimmer" />
        </div>
      )}

      {/* Optional Section Header */}
      {hasHeader && (
        <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && (
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-foreground">
                  {title}
                </h3>
                {count !== undefined && (
                  <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                    {count}
                  </span>
                )}
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {showRefreshButton && (
              <DataRefreshButton
                queryKeys={queryKeys}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                variant={refreshVariant}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Content Area with Smooth Opacity Transition */}
      <div
        className={cn(
          'transition-opacity duration-300 ease-in-out',
          isRefreshing && 'opacity-80',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
