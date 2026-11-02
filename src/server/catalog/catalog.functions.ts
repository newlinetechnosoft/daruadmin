import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  listLiquorSchema,
  listFoodSchema,
  listGrocerySchema,
  listDdcSchema,
  upsertLiquorProductSchema,
  upsertFoodProductSchema,
  upsertGroceryProductSchema,
  upsertDdcProductSchema,
  toggleProductStatusSchema,
  upsertCategorySchema,
  toggleCategoryStatusSchema,
  upsertBrandSchema,
  deleteItemSchema,
  createImageUploadSchema,
  deleteProductImageSchema,
} from './catalog.schemas'
import {
  getLiquorCategoriesQuery,
  getAllLiquorCategoriesQuery,
  getLiquorBrandsQuery,
  getAllLiquorBrandsQuery,
  getLiquorProductsQuery,
  getFoodCategoriesQuery,
  getAllFoodCategoriesQuery,
  getFoodBrandsQuery,
  getAllFoodBrandsQuery,
  getFoodProductsQuery,
  getGroceryCategoriesQuery,
  getAllGroceryCategoriesQuery,
  getGroceryBrandsQuery,
  getAllGroceryBrandsQuery,
  getGroceryProductsQuery,
  getDdcCategoriesQuery,
  getAllDdcCategoriesQuery,
  getDdcBrandsQuery,
  getAllDdcBrandsQuery,
  getDdcProductsQuery,
  getAdminStatsQuery,
  getAdminLiquorProductsQuery,
  getAdminFoodProductsQuery,
  getAdminGroceryProductsQuery,
  getAdminDdcProductsQuery,
  upsertLiquorProductQuery,
  upsertFoodProductQuery,
  upsertGroceryProductQuery,
  upsertDdcProductQuery,
  toggleProductStatusQuery,
  upsertCategoryQuery,
  toggleCategoryStatusQuery,
  upsertBrandQuery,
  deleteItemQuery,
  getAdminUsersQuery,
  updateUserRoleQuery,
  getProductsByIdsQuery,
} from './catalog.queries'
import {
  requirePermission,
  requireRole,
  logAudit,
  getSessionUser,
  getUserGrants,
  can,
} from '#/server/auth/permissions'
import type { ModuleKey } from '#/server/operations/types'

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

export const getFoodBrandsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getFoodBrandsQuery()
  },
)

export const getLiquorProductsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => listLiquorSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    return getLiquorProductsQuery(data)
  })

export const getFoodCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getFoodCategoriesQuery()
  },
)

export const getFoodProductsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => listFoodSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    return getFoodProductsQuery(data)
  })

export const getGroceryCategoriesFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getGroceryCategoriesQuery()
})

export const getGroceryBrandsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getGroceryBrandsQuery()
  },
)

export const getGroceryProductsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => listGrocerySchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    return getGroceryProductsQuery(data)
  })

export const getDdcCategoriesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getDdcCategoriesQuery()
  },
)

export const getDdcBrandsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getDdcBrandsQuery()
  },
)

export const getDdcProductsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => listDdcSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    return getDdcProductsQuery(data)
  })

export const getFrontpageDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [liquorCats, foodCats, liquorProducts, foodProducts, brands] =
      await Promise.all([
        getLiquorCategoriesQuery(),
        getFoodCategoriesQuery(),
        getLiquorProductsQuery({ limit: 12, offset: 0 }),
        getFoodProductsQuery({ limit: 8, offset: 0 }),
        getLiquorBrandsQuery(),
      ])

    return {
      liquorCategories: liquorCats,
      foodCategories: foodCats,
      featuredLiquor: liquorProducts,
      featuredFood: foodProducts,
      brands,
    }
  },
)

export const getProductsByIdsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ ids: z.array(z.string()) }).parse(d ?? { ids: [] }),
  )
  .handler(async ({ data }) => {
    return getProductsByIdsQuery(data.ids)
  })

// -------------------------------------------------------------
// ADMIN SERVER FUNCTIONS WITH PERMISSION ENFORCEMENT
// -------------------------------------------------------------

export const getAdminStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('dashboard', 'view')
    return getAdminStatsQuery()
  },
)

export const getAdminLiquorProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requirePermission('liquor', 'view')
  return getAdminLiquorProductsQuery()
})

export const getAdminFoodProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requirePermission('food', 'view')
  return getAdminFoodProductsQuery()
})

export const getAdminGroceryProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requirePermission('grocery', 'view')
  return getAdminGroceryProductsQuery()
})

export const getAdminDdcProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requirePermission('ddc', 'view')
  return getAdminDdcProductsQuery()
})

export const getAllTaxonomyFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser()
    const grants = await getUserGrants(user)
    const canView =
      can(grants, 'categories', 'view') ||
      can(grants, 'brands', 'view') ||
      can(grants, 'liquor', 'view') ||
      can(grants, 'food', 'view') ||
      can(grants, 'grocery', 'view') ||
      can(grants, 'ddc', 'view')

    if (!canView) {
      throw new Error('403: Forbidden: Insufficient permissions for taxonomy')
    }

    const [
      liquorCategories,
      foodCategories,
      groceryCategories,
      ddcCategories,
      liquorBrands,
      foodBrands,
      groceryBrands,
      ddcBrands,
    ] = await Promise.all([
      getAllLiquorCategoriesQuery(),
      getAllFoodCategoriesQuery(),
      getAllGroceryCategoriesQuery(),
      getAllDdcCategoriesQuery(),
      getAllLiquorBrandsQuery(),
      getAllFoodBrandsQuery(),
      getAllGroceryBrandsQuery(),
      getAllDdcBrandsQuery(),
    ])

    return {
      liquorCategories,
      foodCategories,
      groceryCategories,
      ddcCategories,
      liquorBrands,
      foodBrands,
      groceryBrands,
      ddcBrands,
    }
  },
)

export const getAdminBrandsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('brands', 'view')
    const [liquorBrands, foodBrands, groceryBrands, ddcBrands] =
      await Promise.all([
        getAllLiquorBrandsQuery(),
        getAllFoodBrandsQuery(),
        getAllGroceryBrandsQuery(),
        getAllDdcBrandsQuery(),
      ])
    return {
      liquorBrands,
      foodBrands,
      groceryBrands,
      ddcBrands,
    }
  },
)

export const upsertLiquorProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertLiquorProductSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('liquor', action)
    const result = await upsertLiquorProductQuery(data)
    await logAudit(
      user.name,
      'liquor',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} liquor product: ${data.name}`,
    )
    return result
  })

export const upsertFoodProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertFoodProductSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('food', action)
    const result = await upsertFoodProductQuery(data)
    await logAudit(
      user.name,
      'food',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} food product: ${data.name}`,
    )
    return result
  })

export const upsertGroceryProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertGroceryProductSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('grocery', action)
    const result = await upsertGroceryProductQuery(data)
    await logAudit(
      user.name,
      'grocery',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} grocery product: ${data.name}`,
    )
    return result
  })

export const upsertDdcProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertDdcProductSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('ddc', action)
    const result = await upsertDdcProductQuery(data)
    await logAudit(
      user.name,
      'ddc',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} DDC product: ${data.name}`,
    )
    return result
  })

export const toggleProductStatusFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => toggleProductStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const mod: ModuleKey =
      data.catalogType === 'liquor'
        ? 'liquor'
        : data.catalogType === 'food'
          ? 'food'
          : data.catalogType === 'grocery'
            ? 'grocery'
            : 'ddc'
    const { user } = await requirePermission(mod, 'edit')
    const result = await toggleProductStatusQuery(data)
    await logAudit(
      user.name,
      mod,
      'edit',
      `Toggled status for product ${data.id} in ${data.catalogType} to ${data.field}=${data.value}`,
    )
    return result
  })

export const toggleCategoryStatusFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => toggleCategoryStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('categories', 'edit')
    const result = await toggleCategoryStatusQuery(data)
    await logAudit(
      user.name,
      'categories',
      'edit',
      `Toggled status for category ${data.id} in ${data.catalogType} to ${data.field}=${data.value}`,
    )
    return result
  })

export const upsertCategoryFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertCategorySchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('categories', action)
    const result = await upsertCategoryQuery(data)
    await logAudit(
      user.name,
      'categories',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} category: ${data.name}`,
    )
    return result
  })

export const upsertBrandFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertBrandSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('brands', action)
    const result = await upsertBrandQuery(data)
    await logAudit(
      user.name,
      'brands',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} brand: ${data.name} (${data.catalogType})`,
    )
    return result
  })

export const deleteItemFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => deleteItemSchema.parse(d))
  .handler(async ({ data }) => {
    const action = 'delete'
    const mod: ModuleKey =
      data.catalogType === 'liquor'
        ? 'liquor'
        : data.catalogType === 'food'
          ? 'food'
          : data.catalogType === 'grocery'
            ? 'grocery'
            : data.catalogType === 'ddc'
              ? 'ddc'
              : data.catalogType === 'liquor-brand' ||
                  data.catalogType === 'food-brand' ||
                  data.catalogType === 'grocery-brand' ||
                  data.catalogType === 'ddc-brand'
                ? 'brands'
                : 'categories'
    const { user } = await requirePermission(mod, action)
    const result = await deleteItemQuery(data)
    await logAudit(
      user.name,
      mod,
      'delete',
      `Deleted ${data.catalogType} with id ${data.id}`,
    )
    return result
  })

export const getAdminUsersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('users', 'view')
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
    const { user: actor } = await requireRole('admin')

    if (actor.id === data.userId && data.role !== actor.role) {
      throw new Error('Forbidden: You cannot change your own role')
    }

    const allUsers = await getAdminUsersQuery()
    const targetUser = allUsers.find((u) => u.id === data.userId)

    if (
      targetUser?.role === 'admin' &&
      (data.role !== 'admin' || data.isActive === false)
    ) {
      const activeAdmins = allUsers.filter(
        (u) => u.role === 'admin' && u.isActive !== false,
      )
      if (activeAdmins.length <= 1) {
        throw new Error(
          'Forbidden: Cannot demote or suspend the last remaining admin',
        )
      }
    }

    const result = await updateUserRoleQuery(data)
    await logAudit(
      actor.name,
      'staff',
      'edit',
      `Updated user ${data.userId} to role ${data.role}${data.isActive !== undefined ? ` (active: ${data.isActive})` : ''}`,
    )
    return result
  })

export const checkAdminSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      const user = await getSessionUser()
      const grants = await getUserGrants(user)
      const isStaff = user.role === 'admin' || user.role === 'manager'
      return {
        authenticated: true,
        isAdmin: isStaff,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        grants,
      }
    } catch {
      return { authenticated: false, isAdmin: false, user: null, grants: null }
    }
  },
)

export const createImageUploadFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => createImageUploadSchema.parse(d))
  .handler(async ({ data }) => {
    await requireRole('admin', 'manager')
    const { presignPut, getPublicUrl } = await import('#/lib/storage')
    const ext = data.filename.split('.').pop() || 'jpg'
    const key = `${data.prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const uploadUrl = await presignPut(key, data.contentType)
    const publicUrl = getPublicUrl(key)
    return { uploadUrl, publicUrl, key }
  })

export const deleteProductImageFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => deleteProductImageSchema.parse(d))
  .handler(async ({ data }) => {
    await requireRole('admin', 'manager')
    const { deleteProductImageQuery } = await import('./catalog.queries')
    await deleteProductImageQuery(data.catalogType, data.imageId)

    if (
      data.imageUrl &&
      (data.imageUrl.includes('.storage.') ||
        data.imageUrl.includes('/assets/'))
    ) {
      try {
        const { deleteObject } = await import('#/lib/storage')
        const urlObj = new URL(data.imageUrl)
        const parts = urlObj.pathname.split('/').filter(Boolean)
        if (parts.length >= 2) {
          const key = parts.slice(1).join('/')
          await deleteObject(key)
        }
      } catch (err) {
        console.warn('Failed to delete object from storage:', err)
      }
    }
    return { success: true }
  })

export const verifyNeonServicesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await import('#/db')
    const { liquorProducts, foodProducts } = await import('#/db/schema')
    const { count } = await import('drizzle-orm')
    const { putObject, getObject, deleteObject, getPresignedUrl } =
      await import('#/lib/storage')

    // 1. Verify Postgres query on new Singapore instance
    const [liquorCount] = await db
      .select({ total: count() })
      .from(liquorProducts)
    const [foodCount] = await db
      .select({ total: count() })
      .from(foodProducts)

    // 2. Verify Object Storage in ap-southeast-1
    const testKey = `health-check/${Date.now()}.txt`
    await putObject(testKey, 'neon-object-storage-verified', {
      contentType: 'text/plain',
    })
    const getRes = await getObject(testKey)
    const body = await getRes.Body?.transformToString()
    const presignedUrl = await getPresignedUrl(testKey, 60)
    await deleteObject(testKey)

    return {
      postgres: {
        status: 'healthy',
        region: 'aws-ap-southeast-1',
        counts: {
          liquorProducts: liquorCount.total,
          foodProducts: foodCount.total,
        },
      },
      objectStorage: {
        status: 'healthy',
        region: process.env.AWS_REGION || 'ap-southeast-1',
        bucket: process.env.STORAGE_BUCKET || 'assets',
        roundtripVerified: body === 'neon-object-storage-verified',
        presignedUrlWorks: Boolean(presignedUrl),
      },
    }
  },
)
