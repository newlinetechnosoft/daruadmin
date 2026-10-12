import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createIdbPersister } from '#/lib/idb'

function isWhitelistedKey(queryKey: readonly unknown[]): boolean {
  if (queryKey.length === 0) return false
  const root = queryKey[0]
  if (typeof root !== 'string') return false
  // Persist only safe, non-sensitive public/rider keys:
  // catalog (categories, brands, products), storefront (frontpage), rider portal (assigned deliveries)
  if (root === 'catalog' || root === 'storefront') return true
  if (root === 'rider' && queryKey[1] === 'portal') return true
  return false
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes data freshness
        gcTime: 1000 * 60 * 60 * 24, // 24 hours cache retention for persisted data
        refetchOnWindowFocus: false, // Avoid erratic background refetches
        retry: 1, // Single retry on transient failure
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function createQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
    try {
      persistQueryClient({
        queryClient: browserQueryClient,
        persister: createIdbPersister(),
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: 'mezmani-v1-schema1',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== 'success') return false
            return isWhitelistedKey(query.queryKey)
          },
        },
      })
    } catch (err) {
      console.warn(
        '[TanStack Query] Failed to initialize IDB persistence:',
        err,
      )
    }
  }

  return browserQueryClient
}

export function getContext() {
  const queryClient = createQueryClient()

  return {
    queryClient,
  }
}

export default function TanstackQueryProvider() {}
