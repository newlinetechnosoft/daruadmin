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
} from '#/lib/map-config'
import type { GeoPoint } from '#/lib/map-config'
import {
  ZONE_CONFIG,
} from '#/lib/zone'
import { ZoneRestriction } from '#/components/shared/zone-restriction'
import { useActiveServiceZones } from '#/queries/zones'
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
  /** If true, strictly constrains selection and view to the service zone (defaults to true) */
  restrictToZone?: boolean
  /** Backward-compatible alias for restrictToZone */
  restrictToButwal?: boolean
  /** Warning message displayed if coordinates fall outside the selected zone */
  boundsWarningMessage?: string
  /** Sub-title or prompt text */
  helperText?: string
  /** Whether to render separate read-only latitude & longitude inputs below map */
  showCoordinatesInputs?: boolean
  /** Custom test ID or container class name */
  className?: string
  /** Custom mask fill color */
  maskColor?: string
  /** Custom mask boundary padding (defaults to 0.05) */
  maskPadding?: number
}

// Sub-component to handle map clicks
function MapEventsHandler({
  onSelect,
  restrictToZone = true,
  isInsideZoneFn,
  boundsWarningMessage,
  disabled,
}: {
  onSelect?: (point: GeoPoint) => void
  restrictToZone?: boolean
  isInsideZoneFn?: (lat: number, lng: number) => boolean
  boundsWarningMessage?: string
  disabled?: boolean
}) {
  useMapEvents({
    click(e) {
      if (disabled || !onSelect) return

      const lat = e.latlng.lat
      const lng = e.latlng.lng

      if (restrictToZone) {
        const allowed = isInsideZoneFn ? isInsideZoneFn(lat, lng) : true
        if (!allowed) {
          toast.warning(
            boundsWarningMessage || ZONE_CONFIG.outsideWarningMessage,
          )
          return
        }
      }

      onSelect({ lat, lng })
    },
  })
  return null
}

// Sub-component to fly to marker and invalidate size when container layout shifts
function MapLifecycleHandler({
  position,
  hasPosition,
}: {
  position: [number, number]
  hasPosition: boolean
}) {
  const map = useMap()

  // Invalidate size on mount & animation frames to avoid Leaflet gray-tile issue
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])

  // Center smoothly on position change when a position is actively selected
  useEffect(() => {
    if (hasPosition) {
      map.flyTo(position, map.getZoom(), { animate: true, duration: 0.6 })
    }
  }, [position, hasPosition, map])

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
  restrictToZone = true,
  restrictToButwal,
  boundsWarningMessage,
  helperText,
  showCoordinatesInputs = true,
  className,
  maskColor,
  maskPadding,
}: LocationPickerProps) {
  const [mounted, setMounted] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const markerRef = useRef<L.Marker | null>(null)

  // Support restrictToButwal alias if explicitly passed
  const isRestricted = restrictToButwal !== undefined ? restrictToButwal : restrictToZone
  const { activePolygonRings, unionBounds, isInside, isLoading } =
    useActiveServiceZones()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isInteractive = !disabled && !readOnly

  // Calculate dynamic zone bounds for tile restricting
  const zoneBounds = useMemo(() => {
    return L.latLngBounds(unionBounds[0], unionBounds[1])
  }, [unionBounds])

  const hasValidValue = useMemo(() => {
    if (!value) return false
    const lat = Number(value.lat)
    const lng = Number(value.lng)
    return (
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      lat !== 0 &&
      lng !== 0 &&
      (!isRestricted || isInside(lat, lng))
    )
  }, [value, isRestricted, isInside])

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

        if (isRestricted && !isInside(point.lat, point.lng)) {
          toast.warning(
            'Your device location is outside our service area. Please tap inside the highlighted zone.',
          )
          // As required: Keep map on zone, do NOT move marker
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
  }, [isRestricted, isInside, onChange])

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
                ? 'Click map or drag pin within service zone'
                : 'Selected location')}
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
          minZoom={10}
          maxZoom={19}
          maxBounds={isRestricted ? zoneBounds.pad(maskPadding ?? ZONE_CONFIG.padding) : undefined}
          maxBoundsViscosity={isRestricted ? ZONE_CONFIG.maxBoundsViscosity : undefined}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          {/* TileLayer restricted to zoneBounds so outer tiles are not fetched */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            bounds={isRestricted ? zoneBounds : undefined}
          />

          {/* Service Zone Mask, Bounds Lock, and Outline */}
          {isRestricted && (
            <ZoneRestriction
              activeRings={activePolygonRings}
              maskColor={maskColor}
              padding={maskPadding}
              fitInitial={!hasValidValue}
            />
          )}

          <MapEventsHandler
            onSelect={isInteractive ? onChange : undefined}
            restrictToZone={isRestricted}
            isInsideZoneFn={isInside}
            boundsWarningMessage={boundsWarningMessage}
            disabled={!isInteractive}
          />

          <MapLifecycleHandler
            position={markerPosition}
            hasPosition={hasValidValue}
          />

          {/* Marker rendered when coordinates are set or active */}
          {(hasValidValue || !isRestricted) && (
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
                    if (isRestricted && !isInside(latlng.lat, latlng.lng)) {
                      toast.warning(
                        boundsWarningMessage || ZONE_CONFIG.outsideWarningMessage,
                      )
                      // Reset marker to previous valid position
                      marker.setLatLng(markerPosition)
                      return
                    }
                    onChange({ lat: latlng.lat, lng: latlng.lng })
                  }
                },
              }}
            />
          )}
        </MapContainer>

        {/* Dynamic Zone Loading State Indicator */}
        {isLoading && (
          <div className="absolute top-3 right-3 z-[1000] rounded border border-border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur-xs">
            Syncing service zone...
          </div>
        )}
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
