import { queryOptions, useQuery } from '@tanstack/react-query'
import {
  getActiveZonesFn,
  getAllZonesFn,
} from '#/server/zones/zones.functions'
import {
  geoJsonRingToLeaflet,
  computeMultiRingBounds,
  isPointInsideAnyZone,
} from '#/lib/geo-utils'
import { ZONE_POLYGON, ZONE_BOUNDS } from '#/lib/zone'
import { useMemo } from 'react'

export const zoneQueries = {
  active: () =>
    queryOptions({
      queryKey: ['zones', 'active'],
      queryFn: async () => {
        try {
          return await getActiveZonesFn()
        } catch (err) {
          console.warn('[ZoneQueries] Failed to fetch active zones:', err)
          return {
            type: 'FeatureCollection' as const,
            features: [],
          }
        }
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    }),

  all: () =>
    queryOptions({
      queryKey: ['zones', 'all'],
      queryFn: async () => {
        return await getAllZonesFn()
      },
      staleTime: 1000 * 30, // 30 seconds
    }),
}

/**
 * Custom hook to consume dynamic active service zones in public maps.
 * Handles fallback to the hardcoded Butwal zone if the query is loading, empty, or errors.
 */
export function useActiveServiceZones() {
  const query = useQuery(zoneQueries.active())

  const result = useMemo(() => {
    const features = query.data?.features || []
    const hasActiveFeatures = features.length > 0

    // Extract Leaflet-format rings [lat, lng][]
    const activePolygonRings: [number, number][][] = hasActiveFeatures
      ? features
          .map((f) => {
            const coords = f.geometry.coordinates[0]
            return geoJsonRingToLeaflet(coords)
          })
          .filter((ring) => ring.length >= 3)
      : [ZONE_POLYGON]

    // Compute bounding box covering all active zones
    const unionBounds: [[number, number], [number, number]] =
      hasActiveFeatures && activePolygonRings.length > 0
        ? computeMultiRingBounds(activePolygonRings)
        : ZONE_BOUNDS

    const isInside = (
      lat: number | null | undefined,
      lng: number | null | undefined,
    ): boolean => {
      if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
        return false
      }
      if (!hasActiveFeatures) {
        return isPointInsideAnyZone(lat, lng, [])
      }
      return isPointInsideAnyZone(
        lat,
        lng,
        features.map((f) => ({ polygon: f.geometry, isActive: true })),
      )
    }

    return {
      features,
      activePolygonRings,
      unionBounds,
      isInside,
      hasActiveFeatures,
      fallbackUsed: !hasActiveFeatures,
      isLoading: query.isLoading,
      isError: query.isError,
    }
  }, [query.data, query.isLoading, query.isError])

  return result
}
