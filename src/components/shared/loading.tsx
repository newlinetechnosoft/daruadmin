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
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
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

export function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
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

export function CardSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
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
