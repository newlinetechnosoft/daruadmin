import * as React from 'react'
import { cn } from '#/lib/utils'

export interface FormGridProps {
  columns?: 1 | 2 | 3
  children: React.ReactNode
  className?: string
}

export function FormGrid({ columns = 2, children, className }: FormGridProps) {
  const colClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={cn('grid gap-4 sm:gap-5', colClass, className)}>
      {children}
    </div>
  )
}
