import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  isWithinButwalArea,
} from '#/lib/map-config'
import type { GeoPoint } from '#/lib/map-config'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { MapPin, Navigation, Compass } from 'lucide-react'
import { toast } from 'sonner'

// Fix Leaflet default icon paths in Vite / React bundler
const DefaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultMarkerIcon

/**
 * Nepal approximate geographical bounding box:
 * Southwest: [26.3, 80.0]
 * Northeast: [30.5, 88.2]
 */
export const NEPAL_MAP_BOUNDS: [[number, number], [number, number]] = [
  [26.3, 80.0],
  [30.5, 88.2],
]

export function isWithinNepal(lat: number, lng: number): boolean {
  return lat >= 26.0 && lat <= 30.8 && lng >= 79.8 && lng <= 88.5
}

export interface LocationPickerProps {
  /** Selected coordinate point, or null if unassigned */
  value: GeoPoint | null
  /** Callback triggered when a coordinate is selected or dragged */
  onChange?: (point: GeoPoint) => void
  /** Default map center when value is null */
  defaultCenter?: [number, number]
  /** Default zoom level (defaults to 14) */
  defaultZoom?: number
  /** Tailwind height class for map container (e.g. "h-64 sm:h-72", "h-80") */
  height?: string
  /** Disables click and drag interactions */
  disabled?: boolean
  /** Read-only display mode without editing capabilities */
  readOnly?: boolean
  /** If true, strictly constrains selection to the Butwal customer delivery corridor */
  restrictToButwal?: boolean
  /** Warning message displayed if coordinates fall outside the selected zone */
  boundsWarningMessage?: string
  /** Sub-title or prompt text */
  helperText?: string
  /** Whether to render separate read-only latitude & longitude inputs below map */
  showCoordinatesInputs?: boolean
  /** Custom test ID or container class name */
  className?: string
}

// Sub-component to handle map clicks
function MapEventsHandler({
  onSelect,
  restrictToButwal,
  boundsWarningMessage,
  disabled,
}: {
  onSelect?: (point: GeoPoint) => void
  restrictToButwal?: boolean
  boundsWarningMessage?: string
  disabled?: boolean
}) {
  useMapEvents({
    click(e) {
      if (disabled || !onSelect) return

      const lat = e.latlng.lat
      const lng = e.latlng.lng

      if (restrictToButwal) {
        if (isWithinButwalArea(lat, lng)) {
          onSelect({ lat, lng })
        } else {
          toast.warning(
            boundsWarningMessage ||
              'Please select a location within the Butwal & Tilottama delivery zone.',
          )
        }
        return
      }

      // Admin / general mode: warn if point is outside Nepal
      if (!isWithinNepal(lat, lng)) {
        toast.info(
          'Note: The selected coordinates appear to be outside Nepal territory.',
        )
      }
      onSelect({ lat, lng })
    },
  })
  return null
}

// Sub-component to fly to marker and invalidate size when container layout shifts
function MapLifecycleHandler({ position }: { position: [number, number] }) {
  const map = useMap()

  // Invalidate size on mount & animation frames to avoid Leaflet gray-tile issue
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])

  // Center smoothly on position change
  useEffect(() => {
    map.flyTo(position, map.getZoom(), { animate: true, duration: 0.6 })
  }, [position, map])

  return null
}

export function LocationPicker({
  value,
  onChange,
  defaultCenter = DEFAULT_MAP_CENTER,
  defaultZoom = DEFAULT_MAP_ZOOM,
  height = 'h-64 sm:h-72',
  disabled = false,
  readOnly = false,
  restrictToButwal = false,
  boundsWarningMessage,
  helperText,
  showCoordinatesInputs = true,
  className,
}: LocationPickerProps) {
  const [mounted, setMounted] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isInteractive = !disabled && !readOnly

  const hasValidValue = useMemo(() => {
    if (!value) return false
    const lat = Number(value.lat)
    const lng = Number(value.lng)
    return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0
  }, [value])

  const mapCenter: [number, number] = useMemo(() => {
    if (hasValidValue && value) {
      return [Number(value.lat), Number(value.lng)]
    }
    return defaultCenter
  }, [hasValidValue, value, defaultCenter])

  const markerPosition: [number, number] = useMemo(() => {
    if (hasValidValue && value) {
      return [Number(value.lat), Number(value.lng)]
    }
    return defaultCenter
  }, [hasValidValue, value, defaultCenter])

  const handleLocateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }

        if (restrictToButwal && !isWithinButwalArea(point.lat, point.lng)) {
          toast.warning(
            'Your device location is outside Butwal. Centering on Butwal — please tap the map to place your pin.',
          )
          onChange?.({
            lat: defaultCenter[0],
            lng: defaultCenter[1],
          })
          return
        }

        if (!isWithinNepal(point.lat, point.lng)) {
          toast.warning(
            'Your device location is outside Nepal. Centering on default location.',
          )
          onChange?.({
            lat: defaultCenter[0],
            lng: defaultCenter[1],
          })
          return
        }

        onChange?.(point)
        toast.success('Found your current location!')
      },
      (err) => {
        setIsLocating(false)
        console.warn('[Geolocation error]', err)
        toast.info(
          'Location access was denied or timed out. Please click or drag directly on the map to set the location.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [restrictToButwal, onChange, defaultCenter])

  // SSR Skeleton Placeholder
  if (!mounted) {
    return (
      <div className={`space-y-2.5 ${className || ''}`}>
        <div
          className={`${height} w-full rounded-lg border border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground animate-pulse`}
        >
          <MapPin className="h-6 w-6 text-primary/60" />
          <span className="text-xs font-medium">
            Loading interactive map...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2.5 ${className || ''}`}>
      {/* Top Map Toolbar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5 font-medium text-[11px] sm:text-xs">
          <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">
            {helperText ||
              (isInteractive
                ? 'Click map or drag pin to position location'
                : 'Selected shop location')}
          </span>
        </span>

        {isInteractive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLocating}
            onClick={handleLocateMe}
            className="h-7 text-[11px] gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Navigation
              className={`h-3 w-3 ${isLocating ? 'animate-spin' : 'text-primary'}`}
            />
            {isLocating ? 'Locating...' : 'Use my location'}
          </Button>
        )}
      </div>

      {/* Leaflet Map Frame */}
      <div
        className={`relative ${height} w-full rounded-lg overflow-hidden border border-border shadow-xs z-0 bg-muted/20`}
      >
        <MapContainer
          center={mapCenter}
          zoom={defaultZoom}
          minZoom={6}
          maxZoom={18}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapEventsHandler
            onSelect={isInteractive ? onChange : undefined}
            restrictToButwal={restrictToButwal}
            boundsWarningMessage={boundsWarningMessage}
            disabled={!isInteractive}
          />
          <MapLifecycleHandler position={markerPosition} />

          {/* Marker rendered when coordinates are selected or active */}
          <Marker
            position={markerPosition}
            draggable={isInteractive}
            ref={markerRef}
            eventHandlers={{
              dragend() {
                if (!isInteractive || !onChange) return
                const marker = markerRef.current
                if (marker) {
                  const latlng = marker.getLatLng()
                  if (
                    restrictToButwal &&
                    !isWithinButwalArea(latlng.lat, latlng.lng)
                  ) {
                    toast.warning(
                      boundsWarningMessage ||
                        'Pin dragged outside delivery corridor. Resetting to center.',
                    )
                    marker.setLatLng(defaultCenter)
                    onChange({
                      lat: defaultCenter[0],
                      lng: defaultCenter[1],
                    })
                    return
                  }
                  onChange({ lat: latlng.lat, lng: latlng.lng })
                }
              },
            }}
          />
        </MapContainer>
      </div>

      {/* Coordinate Display / Inputs */}
      {showCoordinatesInputs && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Latitude
            </Label>
            <Input
              readOnly
              tabIndex={-1}
              value={hasValidValue && value ? Number(value.lat).toFixed(6) : ''}
              placeholder="Not set"
              className="h-8 text-xs font-mono bg-muted/30 cursor-default"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Longitude
            </Label>
            <Input
              readOnly
              tabIndex={-1}
              value={hasValidValue && value ? Number(value.lng).toFixed(6) : ''}
              placeholder="Not set"
              className="h-8 text-xs font-mono bg-muted/30 cursor-default"
            />
          </div>
        </div>
      )}
    </div>
  )
}
