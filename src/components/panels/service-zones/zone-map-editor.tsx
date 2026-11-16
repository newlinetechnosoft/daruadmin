import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { ServiceZone } from '#/db/schema/zones'
import { geoJsonRingToLeaflet } from '#/lib/geo-utils'
import { Button } from '#/components/ui/button'
import {
  Maximize2,
  Trash2,
  PlusCircle,
  Pencil,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  MousePointer,
  Sparkles,
} from 'lucide-react'

// Set global L for Geoman compatibility in browser
if (typeof window !== 'undefined') {
  ;(window as any).L = L
}

const DEFAULT_EDITOR_CENTER: [number, number] = [27.65, 83.46]
const DEFAULT_EDITOR_ZOOM = 11

export interface ZoneMapEditorProps {
  zones: ServiceZone[]
  selectedZone: ServiceZone | null
  currentRing: [number, number][]
  onRingChange: (ring: [number, number][]) => void
  onSelectZone: (zone: ServiceZone) => void
  onStartNewZone?: () => void
  isEditing: boolean
  validationError?: string | null
}

/**
 * Creates custom circular Leaflet divIcons for vertices and midpoints.
 */
function createVertexIcon(index: number, isFirst = false) {
  return L.divIcon({
    className: 'zone-vertex-marker',
    html: `<div title="Vertex #${index + 1} (drag to move, click to delete)" style="
      width: 14px;
      height: 14px;
      background: ${isFirst ? '#10b981' : '#f59e0b'};
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      cursor: grab;
      transition: transform 0.1s ease;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function createMidpointIcon() {
  return L.divIcon({
    className: 'zone-midpoint-marker',
    html: `<div title="Click to insert vertex here" style="
      width: 10px;
      height: 10px;
      background: #fcd34d;
      border: 1.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: pointer;
      opacity: 0.85;
      transition: transform 0.1s ease, opacity 0.1s ease;
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })
}

/**
 * Interactive controller inside MapContainer handling:
 * 1. Click-to-add polygon drawing mode with live mouse preview
 * 2. Draggable vertex handles + midpoint insertion handles
 * 3. Muted rendering of other zones with click-to-select
 * 4. Geoman synchronization
 */
function InteractiveZoneController({
  zones,
  selectedZone,
  currentRing,
  onRingChange,
  onSelectZone,
  isDrawing,
  onFinishDrawing,
  isEditing,
}: {
  zones: ServiceZone[]
  selectedZone: ServiceZone | null
  currentRing: [number, number][]
  onRingChange: (ring: [number, number][]) => void
  onSelectZone: (zone: ServiceZone) => void
  isDrawing: boolean
  onFinishDrawing: () => void
  isEditing: boolean
}) {
  const map = useMap()
  const [mousePos, setMousePos] = useState<[number, number] | null>(null)

  // Layers refs
  const mutedGroupRef = useRef<L.LayerGroup | null>(null)
  const activePolygonRef = useRef<L.Polygon | null>(null)
  const drawLineRef = useRef<L.Polyline | null>(null)
  const cursorGuideLineRef = useRef<L.Polyline | null>(null)
  const handlesGroupRef = useRef<L.LayerGroup | null>(null)

  // Initialize Geoman if available
  useEffect(() => {
    let isMounted = true
    if (typeof window === 'undefined') return

    ;(window as any).L = L
    import('@geoman-io/leaflet-geoman-free')
      .then(() => {
        if (!isMounted) return
        try {
          map.pm.addControls({
            position: 'topright',
            drawPolygon: true,
            editMode: true,
            dragMode: false,
            cutPolygon: false,
            removalMode: true,
            drawMarker: false,
            drawCircleMarker: false,
            drawPolyline: false,
            drawRectangle: false,
            drawCircle: false,
            drawText: false,
            rotateMode: false,
          })

          map.pm.setPathOptions({
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.35,
            weight: 3,
          })

          map.on('pm:create', (e) => {
            if (e.shape === 'Polygon' && e.layer instanceof L.Polygon) {
              const raw = e.layer.getLatLngs()
              const ring = Array.isArray(raw[0])
                ? (raw[0] as L.LatLng[]).map((pt) => [pt.lat, pt.lng] as [number, number])
                : (raw as L.LatLng[]).map((pt) => [pt.lat, pt.lng] as [number, number])

              if (ring.length > 0) {
                const first = ring[0]
                const last = ring[ring.length - 1]
                if (first[0] !== last[0] || first[1] !== last[1]) {
                  ring.push([first[0], first[1]])
                }
              }
              map.removeLayer(e.layer)
              onRingChange(ring)
              onFinishDrawing()
            }
          })
        } catch {
          // Geoman controls fallback
        }
      })
      .catch(() => {
        // Fallback to built-in Leaflet editor
      })

    return () => {
      isMounted = false
    }
  }, [map, onRingChange, onFinishDrawing])

  // Map clicks and mouse move events for click-to-draw
  useMapEvents({
    click(e) {
      if (!isDrawing) return

      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng]

      // If user clicked close to the first point with at least 3 points, close polygon
      if (currentRing.length >= 3) {
        const first = currentRing[0]
        const firstLatLng = L.latLng(first[0], first[1])
        const distMeters = map.distance(e.latlng, firstLatLng)

        // If clicked within 40 pixels / ~100m of start point, finish polygon
        if (distMeters < 100 || map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(firstLatLng)) < 25) {
          const closedRing = [...currentRing, [first[0], first[1]] as [number, number]]
          onRingChange(closedRing)
          onFinishDrawing()
          return
        }
      }

      onRingChange([...currentRing, newPoint])
    },
    dblclick(e) {
      if (isDrawing && currentRing.length >= 3) {
        L.DomEvent.stopPropagation(e)
        const first = currentRing[0]
        const closedRing = [...currentRing, [first[0], first[1]] as [number, number]]
        onRingChange(closedRing)
        onFinishDrawing()
      }
    },
    mousemove(e) {
      if (isDrawing && currentRing.length > 0) {
        setMousePos([e.latlng.lat, e.latlng.lng])
      }
    },
  })

  // 1. Render other zones (muted)
  useEffect(() => {
    if (mutedGroupRef.current) {
      map.removeLayer(mutedGroupRef.current)
    }

    const group = L.layerGroup()
    for (const zone of zones) {
      if (selectedZone && zone.id === selectedZone.id) continue

      const coords = zone.polygon.coordinates[0]
      if (coords.length < 3) continue

      const ring = geoJsonRingToLeaflet(coords)
      const layer = L.polygon(ring, {
        color: zone.isActive ? '#10b981' : '#94a3b8',
        fillColor: zone.isActive ? '#10b981' : '#94a3b8',
        fillOpacity: zone.isActive ? 0.2 : 0.1,
        weight: 1.5,
        dashArray: zone.isActive ? undefined : '5, 5',
        interactive: !isDrawing,
      })

      layer.bindTooltip(
        `<b>${zone.name}</b><br/><span style="font-size: 11px;">${
          zone.isActive ? 'Active Zone' : 'Inactive'
        } (${ring.length} pts) — Click to inspect</span>`,
        { sticky: true },
      )

      layer.on('click', () => {
        if (!isDrawing) {
          onSelectZone(zone)
        }
      })

      group.addLayer(layer)
    }

    group.addTo(map)
    mutedGroupRef.current = group

    return () => {
      if (mutedGroupRef.current) {
        map.removeLayer(mutedGroupRef.current)
      }
    }
  }, [map, zones, selectedZone, onSelectZone, isDrawing])

  // 2. Render drawing preview lines (when isDrawing)
  useEffect(() => {
    if (drawLineRef.current) {
      map.removeLayer(drawLineRef.current)
      drawLineRef.current = null
    }
    if (cursorGuideLineRef.current) {
      map.removeLayer(cursorGuideLineRef.current)
      cursorGuideLineRef.current = null
    }

    if (!isDrawing || currentRing.length === 0) return

    // Placed points line
    const line = L.polyline(currentRing, {
      color: '#f59e0b',
      weight: 3,
      dashArray: '6, 6',
      opacity: 0.9,
    }).addTo(map)
    drawLineRef.current = line

    // Dynamic guide line from last point to cursor
    if (mousePos && currentRing.length > 0) {
      const lastPoint = currentRing[currentRing.length - 1]
      const guide = L.polyline([lastPoint, mousePos], {
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '3, 6',
        opacity: 0.6,
      }).addTo(map)
      cursorGuideLineRef.current = guide
    }

    return () => {
      if (drawLineRef.current) map.removeLayer(drawLineRef.current)
      if (cursorGuideLineRef.current) map.removeLayer(cursorGuideLineRef.current)
    }
  }, [map, isDrawing, currentRing, mousePos])

  // 3. Render active polygon and handles (when NOT in raw draw mode and points >= 3)
  useEffect(() => {
    if (activePolygonRef.current) {
      map.removeLayer(activePolygonRef.current)
      activePolygonRef.current = null
    }
    if (handlesGroupRef.current) {
      map.removeLayer(handlesGroupRef.current)
      handlesGroupRef.current = null
    }

    if (currentRing.length < 3) return

    // Render main polygon
    const polygon = L.polygon(currentRing, {
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: 0.35,
      weight: 3,
      interactive: true,
    }).addTo(map)
    activePolygonRef.current = polygon

    // Only render interactive drag/add/remove handles when editing
    if (isEditing && !isDrawing) {
      const handlesGroup = L.layerGroup()

      // Unique vertices (exclude duplicate closing point for closed polygon)
      const isClosed =
        currentRing.length >= 4 &&
        currentRing[0][0] === currentRing[currentRing.length - 1][0] &&
        currentRing[0][1] === currentRing[currentRing.length - 1][1]

      const uniqueVertices = isClosed ? currentRing.slice(0, -1) : currentRing

      // 3A. Draggable Vertex Handles
      uniqueVertices.forEach((coord, idx) => {
        const marker = L.marker(coord, {
          draggable: true,
          icon: createVertexIcon(idx, idx === 0),
          zIndexOffset: 1000 + idx,
        })

        // Real-time live polygon vertex dragging
        marker.on('drag', (e) => {
          const latlng = (e.target as L.Marker).getLatLng()
          const updated = [...uniqueVertices]
          updated[idx] = [latlng.lat, latlng.lng]
          const finalClosed = [...updated, [updated[0][0], updated[0][1]] as [number, number]]
          polygon.setLatLngs(finalClosed)
        })

        // On dragend: save coordinates into state
        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng()
          const updated = [...uniqueVertices]
          updated[idx] = [latlng.lat, latlng.lng]
          const finalClosed = [...updated, [updated[0][0], updated[0][1]] as [number, number]]
          onRingChange(finalClosed)
        })

        // Click vertex to delete (if more than 3 vertices remain)
        marker.on('click', () => {
          if (uniqueVertices.length > 3) {
            const updated = uniqueVertices.filter((_, i) => i !== idx)
            const finalClosed = [...updated, [updated[0][0], updated[0][1]] as [number, number]]
            onRingChange(finalClosed)
          }
        })

        handlesGroup.addLayer(marker)

        // 3B. Midpoint Insertion Handles (between vertex idx and next vertex)
        const nextIdx = (idx + 1) % uniqueVertices.length
        const nextCoord = uniqueVertices[nextIdx]
        const midLat = (coord[0] + nextCoord[0]) / 2
        const midLng = (coord[1] + nextCoord[1]) / 2

        const midMarker = L.marker([midLat, midLng], {
          icon: createMidpointIcon(),
          zIndexOffset: 500,
        })

        midMarker.on('click', () => {
          const updated = [...uniqueVertices]
          updated.splice(idx + 1, 0, [midLat, midLng])
          const finalClosed = [...updated, [updated[0][0], updated[0][1]] as [number, number]]
          onRingChange(finalClosed)
        })

        handlesGroup.addLayer(midMarker)
      })

      handlesGroup.addTo(map)
      handlesGroupRef.current = handlesGroup
    }

    return () => {
      if (activePolygonRef.current) {
        map.removeLayer(activePolygonRef.current)
      }
      if (handlesGroupRef.current) {
        map.removeLayer(handlesGroupRef.current)
      }
    }
  }, [map, currentRing, isEditing, isDrawing, onRingChange])

  return null
}

export function ZoneMapEditor({
  zones,
  selectedZone,
  currentRing,
  onRingChange,
  onSelectZone,
  onStartNewZone,
  isEditing,
  validationError,
}: ZoneMapEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Start Drawing Mode: resets ring and starts placing points
  const handleStartDraw = useCallback(() => {
    setIsDrawing(true)
    onRingChange([])
    if (onStartNewZone) {
      onStartNewZone()
    }
  }, [onRingChange, onStartNewZone])

  // Finish Drawing Mode
  const handleFinishDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  // Undo last point in drawing mode
  const handleUndoPoint = useCallback(() => {
    if (currentRing.length > 0) {
      onRingChange(currentRing.slice(0, -1))
    }
  }, [currentRing, onRingChange])

  // Clear current polygon
  const handleClearPolygon = useCallback(() => {
    onRingChange([])
    setIsDrawing(false)
  }, [onRingChange])

  // Fit view to selected zone
  const handleFitToSelected = useCallback(() => {
    if (!mapRef.current) return
    if (currentRing.length >= 3) {
      const bounds = L.latLngBounds(currentRing)
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else {
      mapRef.current.setView(DEFAULT_EDITOR_CENTER, DEFAULT_EDITOR_ZOOM)
    }
  }, [currentRing])

  // Can finish drawing if >= 3 points placed
  const canFinish = isDrawing && currentRing.length >= 3

  if (!mounted) {
    return (
      <div className="h-[460px] w-full rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground animate-pulse">
        <Pencil className="h-6 w-6 text-primary/60" />
        <span className="text-xs font-mono">Loading service zone editor map...</span>
      </div>
    )
  }

  return (
    <div className="relative h-[480px] sm:h-[520px] w-full rounded-xl overflow-hidden border border-border shadow-xs bg-muted/10">
      {/* Top Map Action Toolbar Overlay */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 bg-background/95 backdrop-blur-md p-1.5 rounded-lg border border-border shadow-md">
        {!isDrawing ? (
          <Button
            type="button"
            size="sm"
            onClick={handleStartDraw}
            className="h-7 text-xs gap-1.5 shadow-none bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Draw New Polygon</span>
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary px-2">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>Drawing Mode</span>
            </div>

            {canFinish && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const first = currentRing[0]
                  const closed = [...currentRing, [first[0], first[1]] as [number, number]]
                  onRingChange(closed)
                  handleFinishDrawing()
                }}
                className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer shadow-none"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Finish & Close ({currentRing.length} pts)</span>
              </Button>
            )}

            {currentRing.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleUndoPoint}
                className="h-7 text-xs gap-1 shadow-none cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Undo</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsDrawing(false)}
              className="h-7 text-xs text-muted-foreground shadow-none cursor-pointer"
            >
              Cancel Draw
            </Button>
          </>
        )}

        {!isDrawing && currentRing.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClearPolygon}
            className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive shadow-none cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear Shape</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleFitToSelected}
          className="h-7 text-xs gap-1.5 shadow-none cursor-pointer"
          title="Fit view to selected zone"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Fit Zone</span>
        </Button>
      </div>

      {/* Drawing Instructions & Vertex Counter Banner */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-md px-3 py-1.5 rounded-md border border-border shadow-xs flex items-center gap-2 text-xs">
        {isDrawing ? (
          <span className="flex items-center gap-1.5 text-primary font-medium">
            <MousePointer className="h-3.5 w-3.5 animate-bounce" />
            <span>
              {currentRing.length === 0
                ? 'Click anywhere on the map to place the 1st vertex.'
                : `Placed ${currentRing.length} points. Click on map to add points, or click 1st point / double click to close.`}
            </span>
          </span>
        ) : currentRing.length >= 4 ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {currentRing.length} vertices (closed) — Drag orange handles to move, click yellow '+' to add vertex.
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>
              {currentRing.length === 0
                ? 'Click "Draw New Polygon" or select an existing zone below.'
                : `${currentRing.length} vertices placed.`}
            </span>
          </span>
        )}
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="absolute top-14 left-3 right-3 sm:right-auto sm:max-w-md z-[1000] bg-destructive/15 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded-lg backdrop-blur-sm shadow-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Unrestricted Leaflet MapContainer */}
      <MapContainer
        center={DEFAULT_EDITOR_CENTER}
        zoom={DEFAULT_EDITOR_ZOOM}
        minZoom={8}
        maxZoom={19}
        doubleClickZoom={!isDrawing}
        scrollWheelZoom={true}
        className={`h-full w-full ${isDrawing ? 'cursor-crosshair' : ''}`}
        ref={(instance) => {
          mapRef.current = instance
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <InteractiveZoneController
          zones={zones}
          selectedZone={selectedZone}
          currentRing={currentRing}
          onRingChange={onRingChange}
          onSelectZone={onSelectZone}
          isDrawing={isDrawing}
          onFinishDrawing={handleFinishDrawing}
          isEditing={isEditing}
        />
      </MapContainer>
    </div>
  )
}
