import { cn } from '#/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'

export type StatusTone =
  'success' | 'warning' | 'destructive' | 'info' | 'neutral'

export interface StatusMapping {
  label: string
  tone: StatusTone
  description?: string
  pulse?: boolean
}

const GLOBAL_STATUS_REGISTRY: Record<string, StatusMapping | undefined> = {
  // Orders
  pending: {
    label: 'Pending',
    tone: 'warning',
    description: 'Order received and awaiting confirmation',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'info',
    description: 'Confirmed by store manager',
  },
  dealer_assigned: {
    label: 'Dealer Assigned',
    tone: 'info',
    description: 'Assigned to dealer for sourcing',
  },
  rider_assigned: {
    label: 'Rider Assigned',
    tone: 'info',
    description: 'Rider dispatched to dealer',
  },
  picked_up: {
    label: 'Picked Up',
    tone: 'info',
    description: 'Rider collected items from dealer',
    pulse: true,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    tone: 'info',
    description: 'En route to customer',
    pulse: true,
  },
  delivered: {
    label: 'Delivered',
    tone: 'success',
    description: 'Successfully handed over to customer',
  },
  delivery_failed: {
    label: 'Delivery Failed',
    tone: 'destructive',
    description: 'Delivery unsuccessful',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'destructive',
    description: 'Order cancelled',
  },
  canceled: {
    label: 'Cancelled',
    tone: 'destructive',
    description: 'Order cancelled',
  },

  // Payments
  cod_pending: {
    label: 'COD Pending',
    tone: 'warning',
    description: 'Cash to be collected upon delivery',
  },
  paid: {
    label: 'Paid',
    tone: 'success',
    description: 'Payment verified and captured',
  },
  failed: {
    label: 'Failed',
    tone: 'destructive',
    description: 'Payment failed',
  },
  refunded: {
    label: 'Refunded',
    tone: 'neutral',
    description: 'Payment reversed to customer',
  },

  // Settlements
  unsettled: {
    label: 'Unsettled',
    tone: 'warning',
    description: 'Payable balance outstanding',
  },
  settled: {
    label: 'Settled',
    tone: 'success',
    description: 'Full amount settled',
  },
  partially_settled: {
    label: 'Partially Settled',
    tone: 'info',
    description: 'Partial balance remaining',
  },

  // Users & Staff
  active: {
    label: 'Active',
    tone: 'success',
    description: 'Account in good standing',
  },
  inactive: {
    label: 'Inactive',
    tone: 'neutral',
    description: 'Disabled or dormant account',
  },
  suspended: {
    label: 'Suspended',
    tone: 'destructive',
    description: 'Account locked or banned',
  },
  banned: {
    label: 'Banned',
    tone: 'destructive',
    description: 'Permanent administrative ban',
  },

  // Riders
  available: {
    label: 'Available',
    tone: 'success',
    description: 'Ready for new deliveries',
  },
  busy: {
    label: 'On Delivery',
    tone: 'info',
    description: 'Currently executing an active delivery',
    pulse: true,
  },
  offline: {
    label: 'Offline',
    tone: 'neutral',
    description: 'Not on active shift',
  },
  on_shift: {
    label: 'On Shift',
    tone: 'success',
    description: 'Checked in and on duty',
  },

  // General / Catalog
  published: {
    label: 'Published',
    tone: 'success',
    description: 'Visible to customers',
  },
  draft: { label: 'Draft', tone: 'neutral', description: 'Work in progress' },
  archived: {
    label: 'Archived',
    tone: 'neutral',
    description: 'Archived from catalog',
  },
}

const TONE_CLASSES: Record<
  StatusTone,
  { dot: string; text: string; bg: string }
> = {
  success: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  warning: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  destructive: {
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  info: {
    dot: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  neutral: {
    dot: 'bg-zinc-400 dark:bg-zinc-500',
    text: 'text-zinc-600 dark:text-zinc-400',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
  },
}

export interface StatusIndicatorProps {
  status: string
  labelOverride?: string
  toneOverride?: StatusTone
  descriptionOverride?: string
  showDescriptionTooltip?: boolean
  asBadge?: boolean
  className?: string
}

/**
 * Frappe-style StatusIndicator for Mezmani.
 * Displays a colored semantic dot alongside clear sentence-case text.
 */
export function StatusIndicator({
  status,
  labelOverride,
  toneOverride,
  descriptionOverride,
  showDescriptionTooltip = true,
  asBadge = false,
  className,
}: StatusIndicatorProps) {
  const normalizedKey = (status || '').toLowerCase().trim()
  const config = GLOBAL_STATUS_REGISTRY[normalizedKey] || {
    label: status ? status.replace(/_/g, ' ') : 'Unknown',
    tone: 'neutral',
  }

  const tone = toneOverride || config.tone
  const label = labelOverride || config.label
  const description = descriptionOverride || config.description
  const styles = TONE_CLASSES[tone]

  const content = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        asBadge && `px-2 py-0.5 rounded-full border ${styles.bg}`,
        styles.text,
        className,
      )}
    >
      <span className="relative flex size-2 shrink-0">
        {config.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              styles.dot,
            )}
          />
        )}
        <span
          className={cn('relative inline-flex size-2 rounded-full', styles.dot)}
        />
      </span>
      <span className="capitalize">{label}</span>
    </div>
  )

  if (description && showDescriptionTooltip) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}
