import { useState, useEffect, useMemo } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type { Rider } from '#/server/operations/types'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Navigation,
  RefreshCw,
  Bike,
  Phone,
  Clock,
  Compass,
  Building2,
  Warehouse,
} from 'lucide-react'
import { formatNPR } from '#/lib/money'

// Configure Leaflet standard icons
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})
L.Marker.prototype.options.icon = DefaultIcon

// Predefined Hub Coordinates in Rupandehi Corridor
const BUTWAL_HUB_COORDS: [number, number] = [27.7006, 83.4484] // Traffic Chowk / Golpark
const TILOTTAMA_HUB_COORDS: [number, number] = [27.652, 83.468] // Drivertole / Manigram

export interface RiderTelemetryMapProps {
  riders: Rider[]
  onRefresh?: () => void
  isRefreshing?: boolean
}

// Controller component to invalidate size and smoothly pan map
function MapController() {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)
    return () => clearTimeout(timer)
  }, [map])

  return null
}

function FlyToHandler({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo(target, 14, { duration: 1 })
  }, [target, map])
  return null
}

function FitBoundsHandler({
  bounds,
}: {
  bounds: L.LatLngBoundsExpression | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!bounds) return
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 1 })
  }, [bounds, map])
  return null
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Never synced'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Never synced'

  const elapsedSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (elapsedSec < 30) return 'Just now'
  if (elapsedSec < 90) return '1 min ago'
  const mins = Math.floor(elapsedSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

export function RiderTelemetryMap({
  riders,
  onRefresh,
  isRefreshing = false,
}: RiderTelemetryMapProps) {
  const [mounted, setMounted] = useState(false)
  const [filter, setFilter] = useState<'all' | 'available' | 'busy' | 'offline'>(
    'all',
  )
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [fitBoundsTarget, setFitBoundsTarget] =
    useState<L.LatLngBoundsExpression | null>(null)

  // 2-minute countdown timer (120 seconds) for next telemetry poll
  const [countdown, setCountdown] = useState(120)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto countdown decrement
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 120 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Reset countdown when refresh finishes
  useEffect(() => {
    if (!isRefreshing) {
      setCountdown(120)
    }
  }, [isRefreshing])

  // Count stats
  const availableRiders = useMemo(
    () => riders.filter((r) => r.status === 'available'),
    [riders],
  )
  const busyRiders = useMemo(
    () => riders.filter((r) => r.status === 'busy'),
    [riders],
  )
  const offlineRiders = useMemo(
    () => riders.filter((r) => r.status === 'offline'),
    [riders],
  )

  // Filtered riders for display
  const displayedRiders = useMemo(() => {
    if (filter === 'all') return riders
    return riders.filter((r) => r.status === filter)
  }, [riders, filter])

  // Custom Hub Markers
  const butwalHubIcon = useMemo(
    () =>
      L.divIcon({
        className: 'custom-hub-marker',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(37,99,235,0.25);animation:pulse 2s infinite;"></div>
            <div style="width:28px;height:28px;border-radius:8px;background:#1d4ed8;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid #ffffff;box-shadow:0 3px 6px rgba(0,0,0,0.3);">
              🏢
            </div>
            <div style="margin-top:2px;background:#1e3a8a;color:#ffffff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              Butwal Hub
            </div>
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 20],
        popupAnchor: [0, -20],
      }),
    [],
  )

  const tilottamaHubIcon = useMemo(
    () =>
      L.divIcon({
        className: 'custom-hub-marker',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,0.25);animation:pulse 2s infinite;"></div>
            <div style="width:28px;height:28px;border-radius:8px;background:#4338ca;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid #ffffff;box-shadow:0 3px 6px rgba(0,0,0,0.3);">
              🏬
            </div>
            <div style="margin-top:2px;background:#312e81;color:#ffffff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              Tilottama Hub
            </div>
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 20],
        popupAnchor: [0, -20],
      }),
    [],
  )

  // Custom Rider DivIcon generator
  const createRiderIcon = (rider: Rider) => {
    const isOnline = rider.status === 'available'
    const isBusy = rider.status === 'busy'

    const bg = isOnline ? '#10b981' : isBusy ? '#f59e0b' : '#64748b'
    const ring = isOnline
      ? '0 0 0 4px rgba(16,185,129,0.35)'
      : isBusy
        ? '0 0 0 4px rgba(245,158,11,0.35)'
        : '0 0 0 2px rgba(100,116,139,0.2)'
    const pingHtml = isOnline
      ? `<div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.5);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
      : isBusy
        ? `<div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,0.5);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
        : ''

    const vehicleSymbol =
      rider.vehicle === 'car' ? '🚗' : rider.vehicle === 'scooter' ? '🛵' : '🏍️'
    const firstName = (rider.name || 'Rider').split(' ')[0]

    return L.divIcon({
      className: 'custom-rider-marker',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
          ${pingHtml}
          <div style="position:relative;width:26px;height:26px;border-radius:50%;background:${bg};color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid #ffffff;box-shadow:${ring};z-index:2;">
            ${vehicleSymbol}
          </div>
          <div style="margin-top:2px;background:rgba(15,23,42,0.88);color:#ffffff;font-size:10px;font-family:monospace;font-weight:600;padding:1px 5px;border-radius:4px;white-space:nowrap;border:1px solid rgba(255,255,255,0.15);box-shadow:0 2px 4px rgba(0,0,0,0.25);z-index:2;">
            ${firstName}
          </div>
        </div>
      `,
      iconSize: [32, 46],
      iconAnchor: [16, 18],
      popupAnchor: [0, -22],
    })
  }

  // Action: Fit all riders & hubs on the screen
  const handleFitAll = () => {
    const points: [number, number][] = [
      BUTWAL_HUB_COORDS,
      TILOTTAMA_HUB_COORDS,
      ...riders
        .filter((r) => r.lat && r.lng)
        .map((r) => [r.lat, r.lng] as [number, number]),
    ]
    if (points.length > 0) {
      setFitBoundsTarget(points)
    }
  }

  return (
    <div className="space-y-3">
      {/* Telemetry Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-muted/40 p-3 rounded-lg border border-border">
        {/* Left: Live status + Hub info */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Telemetry Radar</span>
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            {availableRiders.length} Online • {busyRiders.length} Delivering •{' '}
            {offlineRiders.length} Offline
          </span>
        </div>

        {/* Right: Quick Zoom Actions & Auto-refresh counter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-[11px] text-muted-foreground font-mono hidden md:inline-flex items-center gap-1 mr-1">
            <Clock className="h-3 w-3" />
            <span>Auto-poll: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFlyTarget(BUTWAL_HUB_COORDS)}
            className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
          >
            <Building2 className="h-3 w-3 text-blue-500" />
            <span>Butwal Hub</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFlyTarget(TILOTTAMA_HUB_COORDS)}
            className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
          >
            <Warehouse className="h-3 w-3 text-indigo-500" />
            <span>Tilottama Hub</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFitAll}
            className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
          >
            <Compass className="h-3 w-3" />
            <span>Fit All</span>
          </Button>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
              title="Refresh courier coordinates"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-muted-foreground text-xs font-medium mr-1 shrink-0">
          Filter Beacons:
        </span>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-foreground text-background font-bold'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
        >
          All ({riders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('available')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
            filter === 'available'
              ? 'bg-emerald-600 text-white font-bold'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Online Available ({availableRiders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('busy')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
            filter === 'busy'
              ? 'bg-amber-600 text-white font-bold'
              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          On Delivery ({busyRiders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('offline')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
            filter === 'offline'
              ? 'bg-slate-700 text-white font-bold'
              : 'bg-muted/80 hover:bg-muted text-muted-foreground'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Offline ({offlineRiders.length})
        </button>
      </div>

      {/* Map Frame */}
      <div className="relative h-80 sm:h-96 md:h-[400px] w-full rounded-xl overflow-hidden border border-border shadow-sm z-0 bg-muted/20">
        {!mounted ? (
          <div className="h-full w-full flex flex-col items-center justify-center space-y-2 bg-muted/20">
            <Navigation className="h-6 w-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">
              Loading Leaflet Telemetry Map...
            </span>
          </div>
        ) : (
          <MapContainer
            center={BUTWAL_HUB_COORDS}
            zoom={13}
            minZoom={10}
            maxZoom={18}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController />
            <FlyToHandler target={flyTarget} />
            <FitBoundsHandler bounds={fitBoundsTarget} />

            {/* Hub Marker 1: Butwal Central */}
            <Marker position={BUTWAL_HUB_COORDS} icon={butwalHubIcon}>
              <Popup>
                <div className="space-y-1.5 p-1 font-sans text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-600 text-sm">
                    <Building2 className="h-4 w-4" />
                    <span>Butwal Central Logistics Hub</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    Traffic Chowk & Golpark Sector • Main Valley Dispatch Depot
                  </p>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Coords: 27.7006° N, 83.4484° E
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    Coverage: Sector A & B (Butwal Core)
                  </Badge>
                </div>
              </Popup>
            </Marker>

            {/* Hub Marker 2: Tilottama Hub */}
            <Marker position={TILOTTAMA_HUB_COORDS} icon={tilottamaHubIcon}>
              <Popup>
                <div className="space-y-1.5 p-1 font-sans text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-600 text-sm">
                    <Warehouse className="h-4 w-4" />
                    <span>Tilottama Express Station</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    Drivertole / Manigram / Mangalapur Sector • Southern Sub-Hub
                  </p>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Coords: 27.6520° N, 83.4680° E
                  </div>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    Coverage: Sector C & D (Tilottama Corridor)
                  </Badge>
                </div>
              </Popup>
            </Marker>

            {/* Couriers on Map */}
            {displayedRiders.map((r) => {
              const rLat = typeof r.lat === 'number' && !Number.isNaN(r.lat) ? r.lat : Number(r.lat) || BUTWAL_HUB_COORDS[0]
              const rLng = typeof r.lng === 'number' && !Number.isNaN(r.lng) ? r.lng : Number(r.lng) || BUTWAL_HUB_COORDS[1]
              const pos: [number, number] = [rLat, rLng]

              return (
                <Marker
                  key={r.id}
                  position={pos}
                  icon={createRiderIcon(r)}
                >
                  <Popup>
                    <div className="space-y-2 p-1 font-sans text-xs min-w-[200px]">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Bike className="h-4 w-4 text-primary" />
                          <span>{r.name}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            r.status === 'available'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                              : r.status === 'busy'
                                ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {r.status === 'available'
                            ? 'Online'
                            : r.status === 'busy'
                              ? 'Delivering'
                              : 'Offline'}
                        </span>
                      </div>

                      {/* Info Details */}
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Zone:</span> {r.zone}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Vehicle:</span>{' '}
                          <span className="capitalize">{r.vehicle}</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Cash On Hand:</span>{' '}
                          {formatNPR(r.cashOnHand)}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Deliveries:</span>{' '}
                          {r.deliveries}
                        </div>
                      </div>

                      {/* GPS & Last Updated */}
                      <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span>Coords:</span>
                          <span>
                            {rLat.toFixed(4)}, {rLng.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Reported:</span>
                          <span className="font-semibold text-foreground">
                            {formatTimeAgo(r.updatedAt || r.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      {r.phone ? (
                        <div className="pt-1.5">
                          <a
                            href={`tel:${r.phone}`}
                            className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition-colors"
                          >
                            <Phone className="h-3 w-3" />
                            <span>Call {r.phone}</span>
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
