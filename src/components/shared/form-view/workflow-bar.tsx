import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { cn } from '#/lib/utils'
import type { WorkflowStep } from './types'

export interface WorkflowBarProps {
  steps: WorkflowStep[]
  className?: string
}

export function WorkflowBar({ steps, className }: WorkflowBarProps) {
  if (steps.length === 0) return null

  return (
    <div
      className={cn(
        'w-full overflow-x-auto py-2.5 px-3 rounded-lg border border-border/80 bg-muted/20',
        className,
      )}
    >
      <div className="flex items-center min-w-max gap-2 text-xs">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed'
          const isCurrent = step.status === 'current'
          const isFailed = step.status === 'failed'

          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors',
                  isCompleted &&
                    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium',
                  isCurrent &&
                    'bg-primary text-primary-foreground font-semibold shadow-xs',
                  isFailed &&
                    'bg-rose-500/10 text-rose-700 dark:text-rose-400 font-medium',
                  step.status === 'upcoming' &&
                    'text-muted-foreground opacity-60 font-normal',
                )}
              >
                {isCompleted && <CheckCircle2 className="size-3.5" />}
                {isCurrent && <Circle className="size-3 fill-current" />}
                {isFailed && <AlertCircle className="size-3.5" />}
                <span>{step.label}</span>
              </div>

              {idx < steps.length - 1 && (
                <div className="h-0.5 w-4 bg-border/80 shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
