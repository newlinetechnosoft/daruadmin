import { queryOptions } from '@tanstack/react-query'
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
} from '#/server/catalog/catalog.functions'

export const storefrontQueries = {
  publicSettings: () =>
    queryOptions({
      queryKey: ['store', 'public-settings'],
      queryFn: () => getPublicStoreSettingsFn(),
      staleTime: 1000 * 60 * 5,
    }),

  reviews: () =>
    queryOptions({
      queryKey: ['storefront', 'reviews'],
      queryFn: () => getPublicReviewsFn(),
      staleTime: 1000 * 60 * 5,
    }),

  landingPopups: () =>
    queryOptions({
      queryKey: ['storefront', 'landing-popups'],
      queryFn: () => getPublicLandingNoticesFn(),
      staleTime: 1000 * 60,
    }),

  frontpage: () =>
    queryOptions({
      queryKey: ['storefront', 'frontpage'],
      queryFn: () => getFrontpageDataFn(),
      staleTime: 1000 * 60 * 3, // 3 mins
    }),

  liquorCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'liquor', 'categories'],
      queryFn: () => getLiquorCategoriesFn(),
      staleTime: 1000 * 60 * 10,
    }),

  liquorBrands: () =>
    queryOptions({
      queryKey: ['catalog', 'liquor', 'brands'],
      queryFn: () => getLiquorBrandsFn(),
      staleTime: 1000 * 60 * 10,
    }),

  liquorProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'liquor', 'products', filters],
      queryFn: () => getLiquorProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 3,
    }),

  foodCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'food', 'categories'],
      queryFn: () => getFoodCategoriesFn(),
      staleTime: 1000 * 60 * 10,
    }),

  foodProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'food', 'products', filters],
      queryFn: () => getFoodProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 3,
    }),

  groceryCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'grocery', 'categories'],
      queryFn: () => getGroceryCategoriesFn(),
      staleTime: 1000 * 60 * 10,
    }),

  groceryProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'grocery', 'products', filters],
      queryFn: () => getGroceryProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 3,
    }),

  ddcCategories: () =>
    queryOptions({
      queryKey: ['catalog', 'ddc', 'categories'],
      queryFn: () => getDdcCategoriesFn(),
      staleTime: 1000 * 60 * 10,
    }),

  ddcProducts: (filters: Record<string, any> = {}) =>
    queryOptions({
      queryKey: ['catalog', 'ddc', 'products', filters],
      queryFn: () => getDdcProductsFn({ data: filters }),
      staleTime: 1000 * 60 * 3,
    }),
}
