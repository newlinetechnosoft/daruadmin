import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import {
  ZONE_POLYGON,
  WORLD_MASK_RING,
  ZONE_CONFIG,
} from '#/lib/zone'
import { computeMultiRingBounds } from '#/lib/geo-utils'

export interface ZoneRestrictionProps {
  /** Single zone boundary polygon [lat, lng][] (fallback or single zone mode) */
  zonePolygon?: [number, number][]
  /** Multiple active zone rings [[lat, lng][]] for dynamic multi-zone support */
  activeRings?: [number, number][][]
  /** Viewport boundary padding (defaults to 0.05) */
  padding?: number
  /** Inverted mask solid fill color (defaults to theme background) */
  maskColor?: string
  /** Outline border color (defaults to amber #f59e0b) */
  outlineColor?: string
  /** Outline border weight in pixels (defaults to 2) */
  outlineWeight?: number
  /** Maximum zoom level allowed (defaults to 19) */
  maxZoom?: number
  /** Whether to fit view to bounds on mount (defaults to true) */
  fitInitial?: boolean
  /** Whether the restriction is enabled (defaults to true; set false for admin editor map) */
  enabled?: boolean
}

/**
 * Leaflet map controller component that:
 * 1. Locks the map viewport to all active service zone bounds with maxBoundsViscosity 1.0
 * 2. Dynamically restricts minZoom to getBoundsZoom(unionBounds) so user cannot zoom out past the zones
 * 3. Draws an inverted mask (world ring with every active zone as a hole) on a custom 'mask' pane (z-index 450)
 * 4. Draws thin boundary outline polygons for all active zones
 * 5. Cleans up layers and listeners on unmount or when dynamic zones update (no leaks)
 */
export function ZoneRestriction({
  zonePolygon,
  activeRings,
  padding = ZONE_CONFIG.padding,
  maskColor = ZONE_CONFIG.maskColor,
  outlineColor = ZONE_CONFIG.outlineColor,
  outlineWeight = ZONE_CONFIG.outlineWeight,
  maxZoom = ZONE_CONFIG.maxZoom,
  fitInitial = true,
  enabled = true,
}: ZoneRestrictionProps) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) {
      // If disabled (e.g. in admin editor), do not apply maxBounds or inverted mask
      map.setMaxBounds(null as any)
      return
    }

    // Determine active rings: use activeRings if provided, else zonePolygon or ZONE_POLYGON
    const rings: [number, number][][] =
      activeRings && activeRings.length > 0
        ? activeRings
        : [zonePolygon || ZONE_POLYGON]

    // 1. Calculate union bounds across all active zone rings
    const boundsArray = computeMultiRingBounds(rings)
    const unionBounds = L.latLngBounds(boundsArray[0], boundsArray[1])
    const paddedBounds = unionBounds.pad(padding)

    // 2. Lock map pan & drag boundaries
    map.setMaxBounds(paddedBounds)
    map.options.maxBoundsViscosity = ZONE_CONFIG.maxBoundsViscosity

    // 3. Compute and lock min/max zoom
    const initialMinZoom = map.getBoundsZoom(unionBounds, false)
    map.setMinZoom(initialMinZoom)
    map.setMaxZoom(maxZoom)

    // 4. Initial view fit to active zones
    if (fitInitial) {
      map.fitBounds(unionBounds, { animate: false })
    }

    // 5. Create dedicated 'mask' pane (z-index 450: above tiles, below markers/popups)
    const paneName = ZONE_CONFIG.maskPaneName
    if (!map.getPane(paneName)) {
      const pane = map.createPane(paneName)
      pane.style.zIndex = `${ZONE_CONFIG.maskPaneZIndex}`
      pane.style.pointerEvents = 'none'
    }

    // 6. Draw inverted mask: world polygon with every active zone polygon as a hole
    const maskLayer = L.polygon([WORLD_MASK_RING, ...rings], {
      pane: paneName,
      stroke: false,
      fillColor: maskColor,
      fillOpacity: ZONE_CONFIG.maskOpacity,
      interactive: false,
      className: 'leaflet-zone-mask',
    }).addTo(map)

    // 7. Draw zone boundary outline polygon(s)
    const outlineLayers = rings.map((ring) =>
      L.polygon(ring, {
        color: outlineColor,
        weight: outlineWeight,
        fill: false,
        interactive: false,
        className: 'leaflet-zone-outline',
      }).addTo(map),
    )

    // 8. Recalculate minZoom on container resize
    const handleResize = () => {
      const newMinZoom = map.getBoundsZoom(unionBounds, false)
      map.setMinZoom(newMinZoom)
      if (map.getZoom() < newMinZoom) {
        map.setZoom(newMinZoom)
      }
    }
    map.on('resize', handleResize)

    // 9. Cleanup on unmount or when rings change
    return () => {
      map.off('resize', handleResize)
      maskLayer.remove()
      for (const layer of outlineLayers) {
        layer.remove()
      }
    }
  }, [
    map,
    zonePolygon,
    activeRings,
    padding,
    maskColor,
    outlineColor,
    outlineWeight,
    maxZoom,
    fitInitial,
    enabled,
  ])

  return null
}
