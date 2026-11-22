import * as React from 'react'
import type { GeoPoint } from '#/lib/map-config'
import { isWithinButwalArea } from '#/lib/map-config'
import { Skeleton } from '#/components/ui/skeleton'
import { MapPin } from 'lucide-react'

const LocationPicker = React.lazy(() =>
  import('#/components/shared/location-picker').then((m) => ({
    default: m.LocationPicker,
  })),
)

export interface DeliveryMapProps {
  value: GeoPoint | null
  onChange: (point: GeoPoint) => void
  disabled?: boolean
}

/**
 * Customer delivery location map picker.
 * Wraps the shared LocationPicker with Butwal delivery zone constraints.
 */
export function DeliveryMap({ value, onChange, disabled }: DeliveryMapProps) {
  return (
    <div className="space-y-2.5">
      <React.Suspense
        fallback={
          <div className="h-[280px] sm:h-[340px] w-full rounded-lg border border-border bg-muted/30 flex flex-col items-center justify-center gap-2 p-4 animate-pulse">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        }
      >
        <LocationPicker
          value={value}
          onChange={onChange}
          disabled={disabled}
          restrictToZone={true}
          boundsWarningMessage="This location is outside our service area."
          helperText="Select your delivery Location"
          showCoordinatesInputs={false}
        />
      </React.Suspense>

      {/* Customer Coordinates Display Bar */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>Coordinates:</span>
        </span>
        {value && isWithinButwalArea(value.lat, value.lng) ? (
          <span className="text-foreground font-semibold">
            {Number(value.lat).toFixed(6)}° N, {Number(value.lng).toFixed(6)}° E
          </span>
        ) : (
          <span className="text-primary font-semibold">
            Service Zone (Butwal – Bhairahawa)
          </span>
        )}
      </div>
    </div>
  )
}
