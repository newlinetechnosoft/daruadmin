import { queryOptions } from '@tanstack/react-query'
import { getRiderPortalFn } from '#/server/operations/operations.functions'

export const riderQueries = {
  portal: () =>
    queryOptions({
      queryKey: ['rider', 'portal'],
      queryFn: () => getRiderPortalFn(),
      staleTime: 1000 * 15, // 15 seconds for real-time fleet operations
    }),
}
