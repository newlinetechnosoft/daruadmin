import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '#/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'

interface SettingRowProps {
  label: string
  description?: string
  tooltip?: string
  control: ReactNode
  className?: string
  badge?: ReactNode
}

export function SettingRow({
  label,
  description,
  tooltip,
  control,
  className,
  badge,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/10 transition-colors',
        className,
      )}
    >
      <div className="space-y-0.5 min-w-0 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground leading-tight">
            {label}
          </span>
          {badge}
          {tooltip && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/70 hover:text-foreground inline-flex cursor-help"
                    aria-label={`Info about ${label}`}
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-snug truncate sm:whitespace-normal">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
