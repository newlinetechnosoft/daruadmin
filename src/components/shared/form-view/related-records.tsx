import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Link2, ExternalLink } from 'lucide-react'
import type { RelatedRecord } from './types'
import { cn } from '#/lib/utils'

export interface RelatedRecordsProps {
  records: RelatedRecord[]
  title?: string
  emptyMessage?: string
  className?: string
}

export function RelatedRecords({
  records,
  title = 'Related Records',
  emptyMessage = 'No related records found.',
  className,
}: RelatedRecordsProps) {
  return (
    <Card
      className={cn('border border-border/80 shadow-none bg-card', className)}
    >
      <CardHeader className="p-4 pb-2 border-b border-border/40">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Link2 className="size-3.5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3 space-y-2">
        {records.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            {emptyMessage}
          </p>
        ) : (
          records.map((rec) => (
            <Link
              key={rec.id}
              to={rec.href}
              className="flex items-center justify-between p-2 rounded-md border border-border/60 hover:bg-muted/30 transition-colors group text-xs"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {rec.type}
                </span>
                <span className="font-medium text-foreground truncate group-hover:text-primary">
                  {rec.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {rec.badge && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono px-1.5 py-0"
                  >
                    {rec.badge}
                  </Badge>
                )}
                <ExternalLink className="size-3 text-muted-foreground group-hover:text-foreground" />
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
