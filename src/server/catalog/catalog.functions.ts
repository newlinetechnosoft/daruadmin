import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  listLiquorSchema,
  listGrocerySchema,
  upsertLiquorProductSchema,
  upsertGroceryProductSchema,
  toggleProductStatusSchema,
  upsertCategorySchema,
  upsertBrandSchema,
  deleteItemSchema,
} from './catalog.schemas'
import {
  getLiquorCategoriesQuery,
  getAllLiquorCategoriesQuery,
  getLiquorBrandsQuery,
  getAllLiquorBrandsQuery,
  getLiquorProductsQuery,
  getGroceryCategoriesQuery,
  getAllGroceryCategoriesQuery,
  getGroceryProductsQuery,
  getAdminStatsQuery,
  getAdminLiquorProductsQuery,
  getAdminGroceryProductsQuery,
  upsertLiquorProductQuery,
  upsertGroceryProductQuery,
  toggleProductStatusQuery,
  upsertCategoryQuery,
  upsertBrandQuery,
  deleteItemQuery,
  getAdminUsersQuery,
  updateUserRoleQuery,
} from './catalog.queries'
import { requireAdmin, getServerSession } from '../middleware/auth'

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

// -------------------------------------------------------------
// ADMIN SERVER FUNCTIONS
// -------------------------------------------------------------

export const getAdminStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    return getAdminStatsQuery()
  },
)

export const getAdminLiquorProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAdmin()
  return getAdminLiquorProductsQuery()
})

export const getAdminGroceryProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAdmin()
  return getAdminGroceryProductsQuery()
})

export const getAllTaxonomyFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [liquorCategories, groceryCategories, liquorBrands] =
      await Promise.all([
        getAllLiquorCategoriesQuery(),
        getAllGroceryCategoriesQuery(),
        getAllLiquorBrandsQuery(),
      ])

    return {
      liquorCategories,
      groceryCategories,
      liquorBrands,
    }
  },
)

export const upsertLiquorProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertLiquorProductSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return upsertLiquorProductQuery(data)
  })

export const upsertGroceryProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertGroceryProductSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return upsertGroceryProductQuery(data)
  })

export const toggleProductStatusFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => toggleProductStatusSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return toggleProductStatusQuery(data)
  })

export const upsertCategoryFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertCategorySchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return upsertCategoryQuery(data)
  })

export const upsertBrandFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertBrandSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return upsertBrandQuery(data)
  })

export const deleteItemFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => deleteItemSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return deleteItemQuery(data)
  })

export const getAdminUsersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    return getAdminUsersQuery()
  },
)

export const updateUserRoleFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        userId: z.string(),
        role: z.string(),
        isActive: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    return updateUserRoleQuery(data)
  })

export const checkAdminSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getServerSession()
    if (!session?.user) {
      return { authenticated: false, isAdmin: false, user: null }
    }
    const user = session.user as typeof session.user & { role?: string }
    return {
      authenticated: true,
      isAdmin: user.role === 'admin' || user.role === 'manager',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  },
)
