import { queryOptions } from '@tanstack/react-query'
import {
  getFrontpageDataFn,
  getFoodCategoriesFn,
  getFoodProductsFn,
  getLiquorBrandsFn,
  getLiquorCategoriesFn,
  getLiquorProductsFn,
} from '#/server/catalog/catalog.functions'

export const storefrontQueries = {
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
}
