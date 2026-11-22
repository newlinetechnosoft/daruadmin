import { queryOptions, keepPreviousData } from '@tanstack/react-query'
import {
  getPublicLandingNoticesFn,
  getPublicStoreSettingsFn,
  getPublicReviewsFn,
} from '#/server/operations/operations.functions'
import {
  getFrontpageDataFn,
  getFoodCategoriesFn,
  getFoodProductsFn,
  getGroceryCategoriesFn,
  getGroceryProductsFn,
  getDdcCategoriesFn,
  getDdcProductsFn,
  getLiquorBrandsFn,
  getLiquorCategoriesFn,
  getLiquorProductsFn,
  getPairingRecommendationsFn,
} from '#/server/catalog/catalog.functions'

export const storefrontQueries = {
  publicSettings: () =>
    queryOptions({
      queryKey: ['store', 'public-settings'],
      queryFn: () => getPublicStoreSettingsFn(),
      staleTime: 1000 * 60 * 10,
    }),

  reviews: () =>
    queryOptions({
      queryKey: ['storefront', 'reviews'],
      queryFn: () => getPublicReviewsFn(),
      staleTime: 1000 * 60 * 10,
    }),

  landingPopups: () =>
    queryOptions({
      queryKey: ['storefront', 'landing-popups'],
      queryFn: () => getPublicLandingNoticesFn(),
      staleTime: 1000 * 60 * 5,
    }),

  frontpage: () =>
    queryOptions({
      queryKey: ['storefront', 'frontpage'],
      queryFn: () => getFrontpageDataFn(),
      staleTime: 1000 * 60 * 5,
    }),

  liquorCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'liquor', 'categories'],
      queryFn: () => getLiquorCategoriesFn(),
      staleTime: 1000 * 60 * 15,
    }),

  liquorBrands: () =>
    queryOptions({
      queryKey: ['catalog', 'liquor', 'brands'],
      queryFn: () => getLiquorBrandsFn(),
      staleTime: 1000 * 60 * 15,
    }),

  liquorProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'liquor', 'products', filters],
      queryFn: () => getLiquorProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    }),

  foodCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'food', 'categories'],
      queryFn: () => getFoodCategoriesFn(),
      staleTime: 1000 * 60 * 15,
    }),

  foodProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'food', 'products', filters],
      queryFn: () => getFoodProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    }),

  groceryCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'grocery', 'categories'],
      queryFn: () => getGroceryCategoriesFn(),
      staleTime: 1000 * 60 * 15,
    }),

  groceryProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'grocery', 'products', filters],
      queryFn: () => getGroceryProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    }),

  ddcCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'ddc', 'categories'],
      queryFn: () => getDdcCategoriesFn(),
      staleTime: 1000 * 60 * 15,
    }),

  ddcProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'ddc', 'products', filters],
      queryFn: () => getDdcProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    }),

  pairingRecommendations: (params: {
    catalogType: 'liquor' | 'food' | 'grocery' | 'ddc'
    currentProductId?: string
  }) =>
    queryOptions({
      queryKey: [
        'storefront',
        'pairing-recommendations',
        params.catalogType,
        params.currentProductId || 'all',
      ],
      queryFn: () => getPairingRecommendationsFn({ data: params }),
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    }),
}
