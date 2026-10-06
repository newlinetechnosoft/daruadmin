import { createServerFn } from '@tanstack/react-start'
import { listLiquorSchema, listGrocerySchema } from './catalog.schemas'
import {
  getLiquorCategoriesQuery,
  getLiquorBrandsQuery,
  getLiquorProductsQuery,
  getGroceryCategoriesQuery,
  getGroceryProductsQuery,
} from './catalog.queries'

export const getLiquorCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getLiquorCategoriesQuery()
  },
)

export const getLiquorBrandsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getLiquorBrandsQuery()
  },
)

export const getLiquorProductsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => listLiquorSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    return getLiquorProductsQuery(data)
  })

export const getGroceryCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getGroceryCategoriesQuery()
  },
)

export const getGroceryProductsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => listGrocerySchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    return getGroceryProductsQuery(data)
  })

export const getFrontpageDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [liquorCats, groceryCats, liquorProducts, groceryProducts, brands] =
      await Promise.all([
        getLiquorCategoriesQuery(),
        getGroceryCategoriesQuery(),
        getLiquorProductsQuery({ limit: 12, offset: 0 }),
        getGroceryProductsQuery({ limit: 8, offset: 0 }),
        getLiquorBrandsQuery(),
      ])

    return {
      liquorCategories: liquorCats,
      groceryCategories: groceryCats,
      featuredLiquor: liquorProducts,
      featuredGrocery: groceryProducts,
      brands,
    }
  },
)
