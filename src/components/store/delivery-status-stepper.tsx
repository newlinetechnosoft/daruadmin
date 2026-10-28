import {
  CheckCircle2,
  Clock,
  Store,
  Bike,
  PackageCheck,
  Ban,
  AlertTriangle,
} from 'lucide-react'

interface DeliveryStatusStepperProps {
  status: string
  cancellationReason?: string | null
}

const STEPS = [
  {
    key: 'placed',
    label: 'Order Placed',
    description: 'Received by Mezmani Hub',
    icon: Clock,
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    description: 'Accepted & Verified',
    icon: CheckCircle2,
  },
  {
    key: 'sourcing',
    label: 'Dealer Sourcing',
    description: 'Items packed at partner shop',
    icon: Store,
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'Courier en route to your door',
    icon: Bike,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Order handed over',
    icon: PackageCheck,
  },
]

export function DeliveryStatusStepper({
  status,
  cancellationReason,
}: DeliveryStatusStepperProps) {
  if (status === 'cancelled') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <Ban className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-bold text-destructive uppercase tracking-wide">
          Order Cancelled
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {cancellationReason || 'This order was cancelled.'}
        </p>
      </div>
    )
  }

  if (status === 'delivery_failed' || status === 'returned') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
          Delivery Attempt Rescheduled
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Courier was unable to complete delivery. Our dispatch team is
          contacting you to coordinate redelivery.
        </p>
      </div>
    )
  }

  // Calculate current active step index (0-based)
  // Step 0: pending
  // Step 1: confirmed
  // Step 2: dealer_assigned, rider_assigned, picked_up
  // Step 3: out_for_delivery
  // Step 4: delivered
  let currentStepIndex = 0
  if (status === 'confirmed') {
    currentStepIndex = 1
  } else if (
    status === 'dealer_assigned' ||
    status === 'rider_assigned' ||
    status === 'picked_up'
  ) {
    currentStepIndex = 2
  } else if (status === 'out_for_delivery') {
    currentStepIndex = 3
  } else if (status === 'delivered') {
    currentStepIndex = 4
  }

  return (
    <div className="w-full py-2">
      {/* Stepper for Desktop/Tablet */}
      <div className="hidden sm:grid grid-cols-5 relative gap-2">
        {/* Progress connecting lines */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-border -z-0">
          <div
            className="h-full bg-primary transition-all duration-500 ease-in-out"
            style={{
              width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%`,
            }}
          />
        </div>

        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIndex
          const isCurrent = idx === currentStepIndex
          const StepIcon = step.icon

          return (
            <div
              key={step.key}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-primary bg-background text-primary ring-4 ring-primary/20 animate-pulse'
                      : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <StepIcon className="h-4 w-4" />
              </div>
              <span
                className={`mt-2 text-xs font-semibold ${
                  isCompleted || isCurrent
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-muted-foreground hidden lg:block leading-tight mt-0.5">
                {step.description}
              </span>
            </div>
          )
        })}
      </div>

      {/* Stepper for Mobile (Vertical) */}
      <div className="sm:hidden space-y-3 pl-2">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIndex
          const isCurrent = idx === currentStepIndex
          const isPending = idx > currentStepIndex
          const StepIcon = step.icon

          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-primary bg-background text-primary ring-4 ring-primary/20 animate-pulse'
                        : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <StepIcon className="h-3.5 w-3.5" />
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-6 mt-1 ${
                      isCompleted ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
              <div className="pt-0.5">
                <div
                  className={`text-xs font-semibold ${
                    isPending ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
