import { useState, useEffect, useRef, useMemo } from 'react'
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
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '#/lib/map-config'
import type { GeoPoint } from '#/lib/map-config'
import { Button } from '#/components/ui/button'
import { MapPin, Navigation, Compass } from 'lucide-react'
import { toast } from 'sonner'

// Fix Leaflet default icon paths in bundler
const DefaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultMarkerIcon

interface DeliveryMapProps {
  value: GeoPoint | null
  onChange: (point: GeoPoint) => void
  disabled?: boolean
}

// Sub-component to handle map clicks and fly-to transitions
function MapClickHandler({
  onSelect,
}: {
  onSelect: (point: GeoPoint) => void
}) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function MapPanTo({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, map.getZoom(), { animate: true, duration: 0.8 })
  }, [position, map])
  return null
}

export function DeliveryMap({ value, onChange, disabled }: DeliveryMapProps) {
  const [mounted, setMounted] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentCenter: [number, number] = useMemo(() => {
    if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
      return [value.lat, value.lng]
    }
    return DEFAULT_MAP_CENTER
  }, [value])

  const markerPosition: [number, number] | null = useMemo(() => {
    if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
      return [value.lat, value.lng]
    }
    return null
  }, [value])

  const handleLocateMe = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        onChange(point)
        setIsLocating(false)
        toast.success('Found your current location!')
      },
      (err) => {
        setIsLocating(false)
        console.warn('[Geolocation error]', err)
        toast.info(
          'Location access was denied or timed out. Please tap directly on the map to drop your delivery pin.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  // SSR Skeleton Placeholder with fixed height to avoid layout shift
  if (!mounted) {
    return (
      <div className="space-y-2">
        <div className="h-64 sm:h-72 w-full rounded-lg border border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground animate-pulse">
          <MapPin className="h-6 w-6 text-primary/60" />
          <span className="text-xs font-medium">Loading delivery map...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Top Map Toolbar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
          <Compass className="h-3.5 w-3.5 text-primary" />
          Tap map or drag pin to your delivery address
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLocating}
          onClick={handleLocateMe}
          className="h-7 text-[11px] gap-1.5 cursor-pointer shadow-xs"
        >
          <Navigation className={`h-3 w-3 ${isLocating ? 'animate-spin' : 'text-primary'}`} />
          {isLocating ? 'Locating...' : 'Use my current location'}
        </Button>
      </div>

      {/* Leaflet Map Container */}
      <div className="relative h-64 sm:h-72 w-full rounded-lg overflow-hidden border border-border shadow-xs z-0">
        <MapContainer
          center={currentCenter}
          zoom={DEFAULT_MAP_ZOOM}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onSelect={onChange} />
          {markerPosition && <MapPanTo position={markerPosition} />}

          {markerPosition && (
            <Marker
              position={markerPosition}
              draggable={!disabled}
              ref={markerRef}
              eventHandlers={{
                dragend() {
                  const marker = markerRef.current
                  if (marker) {
                    const latlng = marker.getLatLng()
                    onChange({ lat: latlng.lat, lng: latlng.lng })
                  }
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Coordinates Display */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>Coordinates:</span>
        </span>
        {value ? (
          <span className="text-foreground font-semibold">
            {value.lat.toFixed(6)}° N, {value.lng.toFixed(6)}° E
          </span>
        ) : (
          <span className="text-destructive font-semibold">
            No pin selected (Click map above)
          </span>
        )}
      </div>
    </div>
  )
}
