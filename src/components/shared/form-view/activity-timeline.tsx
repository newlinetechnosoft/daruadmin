import { DateText } from '#/components/shared/date-text'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { History } from 'lucide-react'
import type { TimelineEvent } from './types'
import { cn } from '#/lib/utils'

export interface ActivityTimelineProps {
  events: TimelineEvent[]
  title?: string
  emptyMessage?: string
  className?: string
}

const TONE_DOT_CLASSES: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  destructive: 'bg-rose-500',
  info: 'bg-blue-500',
  neutral: 'bg-muted-foreground',
}

export function ActivityTimeline({
  events,
  title = 'Activity Timeline',
  emptyMessage = 'No recorded activity yet.',
  className,
}: ActivityTimelineProps) {
  return (
    <Card
      className={cn('border border-border/80 shadow-none bg-card', className)}
    >
      <CardHeader className="p-4 pb-2 border-b border-border/40">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <History className="size-3.5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            {emptyMessage}
          </p>
        ) : (
          <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border/80">
            {events.map((ev) => {
              const dotColor =
                TONE_DOT_CLASSES[ev.tone || 'neutral'] || 'bg-muted-foreground'

              return (
                <div key={ev.id} className="relative space-y-1 text-xs">
                  <span
                    className={cn(
                      'absolute -left-[19px] top-1 size-2 rounded-full ring-4 ring-card',
                      dotColor,
                    )}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {ev.title}
                    </span>
                    <DateText
                      date={ev.timestamp}
                      showRelative
                      className="text-[10px] text-muted-foreground"
                    />
                  </div>
                  {ev.description && (
                    <p className="text-[11px] text-muted-foreground">
                      {ev.description}
                    </p>
                  )}
                  {ev.actor && (
                    <p className="text-[10px] text-muted-foreground/80 font-mono">
                      By: {ev.actor}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
