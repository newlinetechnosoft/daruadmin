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
  createImageUploadSchema,
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
  getProductsByIdsQuery,
} from './catalog.queries'
import {
  requirePermission,
  requireRole,
  logAudit,
  getSessionUser,
  getUserGrants,
} from '#/server/auth/permissions'

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
  await requirePermission('products', 'view')
  return getAdminLiquorProductsQuery()
})

export const getAdminGroceryProductsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requirePermission('products', 'view')
  return getAdminGroceryProductsQuery()
})

export const getAllTaxonomyFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('products', 'view')
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
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('products', action)
    const result = await upsertLiquorProductQuery(data)
    await logAudit(
      user.name,
      'products',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} liquor product: ${data.name}`,
    )
    return result
  })

export const upsertGroceryProductFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertGroceryProductSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('products', action)
    const result = await upsertGroceryProductQuery(data)
    await logAudit(
      user.name,
      'products',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} grocery product: ${data.name}`,
    )
    return result
  })

export const toggleProductStatusFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => toggleProductStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('products', 'edit')
    const result = await toggleProductStatusQuery(data)
    await logAudit(
      user.name,
      'products',
      'edit',
      `Toggled status for product ${data.id} in ${data.catalogType} to ${data.field}=${data.value}`,
    )
    return result
  })

export const upsertCategoryFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertCategorySchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('products', action)
    const result = await upsertCategoryQuery(data)
    await logAudit(
      user.name,
      'products',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} category: ${data.name}`,
    )
    return result
  })

export const upsertBrandFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => upsertBrandSchema.parse(d))
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('products', action)
    const result = await upsertBrandQuery(data)
    await logAudit(
      user.name,
      'products',
      action,
      `${action === 'create' ? 'Created' : 'Updated'} brand: ${data.name}`,
    )
    return result
  })

export const deleteItemFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => deleteItemSchema.parse(d))
  .handler(async ({ data }) => {
    const action = 'delete'
    const { user } = await requirePermission('products', action)
    const result = await deleteItemQuery(data)
    await logAudit(
      user.name,
      'products',
      'delete',
      `Deleted ${data.catalogType} with id ${data.id}`,
    )
    return result
  })

export const getAdminUsersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('staff', 'view')
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
    await requireRole('admin')
    const { presignPut, getPublicUrl } = await import('#/lib/storage')
    const ext = data.filename.split('.').pop() || 'jpg'
    const key = `${data.prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const uploadUrl = await presignPut(key, data.contentType)
    const publicUrl = getPublicUrl(key)
    return { uploadUrl, publicUrl, key }
  })

export const verifyNeonServicesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { db } = await import('#/db')
    const { liquorProducts, groceryProducts } = await import('#/db/schema')
    const { count } = await import('drizzle-orm')
    const { putObject, getObject, deleteObject, getPresignedUrl } = await import('#/lib/storage')

    // 1. Verify Postgres query on new Singapore instance
    const [liquorCount] = await db.select({ total: count() }).from(liquorProducts)
    const [groceryCount] = await db.select({ total: count() }).from(groceryProducts)

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
          liquorProducts: liquorCount?.total ?? 0,
          groceryProducts: groceryCount?.total ?? 0,
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

