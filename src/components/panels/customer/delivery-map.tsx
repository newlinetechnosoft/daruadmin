import { LocationPicker } from '#/components/shared/location-picker'
import type { GeoPoint } from '#/lib/map-config'
import { DEFAULT_MAP_CENTER, isWithinButwalArea } from '#/lib/map-config'
import { MapPin } from 'lucide-react'

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
      <LocationPicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        restrictToButwal={true}
        boundsWarningMessage="Please select a location within the Butwal & Tilottama delivery zone."
        helperText="Tap map or drag pin to your address in Butwal"
        showCoordinatesInputs={false}
      />

      {/* Customer Coordinates Display Bar */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>Coordinates (Butwal):</span>
        </span>
        {value && isWithinButwalArea(value.lat, value.lng) ? (
          <span className="text-foreground font-semibold">
            {Number(value.lat).toFixed(6)}° N, {Number(value.lng).toFixed(6)}° E
          </span>
        ) : (
          <span className="text-primary font-semibold">
            {DEFAULT_MAP_CENTER[0].toFixed(6)}° N,{' '}
            {DEFAULT_MAP_CENTER[1].toFixed(6)}° E (Traffic Chowk)
          </span>
        )}
      </div>
    </div>
  )
}
