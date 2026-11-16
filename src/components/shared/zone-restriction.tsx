import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import {
  ZONE_POLYGON,
  WORLD_MASK_RING,
  ZONE_CONFIG,
} from '#/lib/zone'

export interface ZoneRestrictionProps {
  /** Zone boundary polygon (defaults to ZONE_POLYGON) */
  zonePolygon?: [number, number][]
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
}

/**
 * Leaflet map controller component that:
 * 1. Locks the map viewport to the service zone bounds with maxBoundsViscosity 1.0
 * 2. Dynamically restricts minZoom to getBoundsZoom(zoneBounds) so user cannot zoom out past the zone
 * 3. Draws an inverted mask (world ring with zone hole) on a custom 'mask' pane (z-index 450)
 * 4. Draws a thin boundary outline polygon of the service zone
 * 5. Cleans up layers and listeners on unmount
 */
export function ZoneRestriction({
  zonePolygon = ZONE_POLYGON,
  padding = ZONE_CONFIG.padding,
  maskColor = ZONE_CONFIG.maskColor,
  outlineColor = ZONE_CONFIG.outlineColor,
  outlineWeight = ZONE_CONFIG.outlineWeight,
  maxZoom = ZONE_CONFIG.maxZoom,
  fitInitial = true,
}: ZoneRestrictionProps) {
  const map = useMap()

  useEffect(() => {
    // 1. Calculate zone bounds
    const zoneBounds = L.latLngBounds(zonePolygon)
    const paddedBounds = zoneBounds.pad(padding)

    // 2. Lock map pan & drag boundaries
    map.setMaxBounds(paddedBounds)
    map.options.maxBoundsViscosity = ZONE_CONFIG.maxBoundsViscosity

    // 3. Compute and lock min/max zoom
    const initialMinZoom = map.getBoundsZoom(zoneBounds, false)
    map.setMinZoom(initialMinZoom)
    map.setMaxZoom(maxZoom)

    // 4. Initial view fit to zone
    if (fitInitial) {
      map.fitBounds(zoneBounds, { animate: false })
    }

    // 5. Create dedicated 'mask' pane (z-index 450: above tiles, below markers/popups)
    const paneName = ZONE_CONFIG.maskPaneName
    if (!map.getPane(paneName)) {
      const pane = map.createPane(paneName)
      pane.style.zIndex = `${ZONE_CONFIG.maskPaneZIndex}`
      pane.style.pointerEvents = 'none'
    }

    // 6. Draw inverted mask (world polygon with zone as hole)
    const maskLayer = L.polygon([WORLD_MASK_RING, zonePolygon], {
      pane: paneName,
      stroke: false,
      fillColor: maskColor,
      fillOpacity: ZONE_CONFIG.maskOpacity,
      interactive: false,
      className: 'leaflet-zone-mask',
    }).addTo(map)

    // 7. Draw zone boundary outline polygon
    const outlineLayer = L.polygon(zonePolygon, {
      color: outlineColor,
      weight: outlineWeight,
      fill: false,
      interactive: false,
      className: 'leaflet-zone-outline',
    }).addTo(map)

    // 8. Recalculate minZoom on container resize
    const handleResize = () => {
      const newMinZoom = map.getBoundsZoom(zoneBounds, false)
      map.setMinZoom(newMinZoom)
      if (map.getZoom() < newMinZoom) {
        map.setZoom(newMinZoom)
      }
    }
    map.on('resize', handleResize)

    // 9. Cleanup on unmount
    return () => {
      map.off('resize', handleResize)
      maskLayer.remove()
      outlineLayer.remove()
    }
  }, [
    map,
    zonePolygon,
    padding,
    maskColor,
    outlineColor,
    outlineWeight,
    maxZoom,
    fitInitial,
  ])

  return null
}
