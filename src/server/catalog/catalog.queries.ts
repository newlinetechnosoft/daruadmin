import { moveToRecycleBin } from '#/server/recycle-bin/recycle-bin.queries'
import { db, dbTx, type DbTx } from '#/db'
import {
  liquorCategories,
  liquorBrands,
  liquorProducts,
  liquorVariants,
  liquorImages,
  foodCategories,
  foodBrands,
  foodProducts,
  foodVariants,
  foodImages,
  groceryCategories,
  groceryBrands,
  groceryProducts,
  groceryVariants,
  groceryImages,
  ddcCategories,
  ddcBrands,
  ddcProducts,
  ddcVariants,
  ddcImages,
  dealerStock,
  dealerItems,
  dealers,
  user,
} from '#/db/schema'
import {
  and,
  eq,
  ilike,
  or,
  asc,
  desc,
  count,
  inArray,
  notInArray,
  sum,
  lte,
  sql,
  isNull,
} from 'drizzle-orm'
import type {
  ListLiquorInput,
  ListFoodInput,
  ListGroceryInput,
  ListDdcInput,
  UpsertLiquorProductInput,
  UpsertFoodProductInput,
  UpsertGroceryProductInput,
  UpsertDdcProductInput,
  ToggleProductStatusInput,
  UpsertCategoryInput,
  ToggleCategoryStatusInput,
  UpsertBrandInput,
  DeleteItemInput,
} from './catalog.schemas'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// -------------------------------------------------------------
// HIGH-SPEED IN-MEMORY CACHE WITH TTL (AUTO-INVALIDATING)
// -------------------------------------------------------------
interface CacheEntry<T> {
  data: T
  expires: number
}

const catalogMemoryCache = new Map<string, CacheEntry<any>>()

export function getCatalogCached<T>(key: string): T | null {
  const item = catalogMemoryCache.get(key)
  if (!item) return null
  if (Date.now() > item.expires) {
    catalogMemoryCache.delete(key)
    return null
  }
  return item.data as T
}

export function setCatalogCached<T>(key: string, data: T, ttlMs = 60_000): T {
  catalogMemoryCache.set(key, { data, expires: Date.now() + ttlMs })
  return data
}

export function invalidateCatalogCache(prefix?: string) {
  if (!prefix) {
    catalogMemoryCache.clear()
    return
  }
  for (const k of catalogMemoryCache.keys()) {
    if (k.startsWith(prefix)) {
      catalogMemoryCache.delete(k)
    }
  }
}

export async function getLiquorCategoriesQuery() {
  const cached = getCatalogCached<any[]>('liquor_categories')
  if (cached) return cached

  const rows = await db
    .select()
    .from(liquorCategories)
    .where(eq(liquorCategories.isActive, true))
    .orderBy(asc(liquorCategories.sortOrder), asc(liquorCategories.name))

  return setCatalogCached('liquor_categories', rows, 60_000)
}

export async function getAllLiquorCategoriesQuery() {
  const cached = getCatalogCached<any[]>('all_liquor_categories')
  if (cached) return cached

  const rows = await db
    .select({
      id: liquorCategories.id,
      name: liquorCategories.name,
      slug: liquorCategories.slug,
      description: liquorCategories.description,
      imageUrl: liquorCategories.imageUrl,
      sortOrder: liquorCategories.sortOrder,
      isActive: liquorCategories.isActive,
      showOnLandingPage: liquorCategories.showOnLandingPage,
      createdAt: liquorCategories.createdAt,
      updatedAt: liquorCategories.updatedAt,
      productCount: count(liquorProducts.id),
    })
    .from(liquorCategories)
    .leftJoin(
      liquorProducts,
      eq(liquorCategories.id, liquorProducts.categoryId),
    )
    .groupBy(liquorCategories.id)
    .orderBy(asc(liquorCategories.sortOrder), asc(liquorCategories.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_liquor_categories', result, 60_000)
}

export async function getLiquorBrandsQuery() {
  const cached = getCatalogCached<any[]>('liquor_brands')
  if (cached) return cached

  const rows = await db
    .select()
    .from(liquorBrands)
    .where(eq(liquorBrands.isActive, true))
    .orderBy(asc(liquorBrands.name))

  return setCatalogCached('liquor_brands', rows, 60_000)
}

export async function getAllLiquorBrandsQuery() {
  const cached = getCatalogCached<any[]>('all_liquor_brands')
  if (cached) return cached

  const rows = await db
    .select({
      id: liquorBrands.id,
      name: liquorBrands.name,
      slug: liquorBrands.slug,
      origin: liquorBrands.origin,
      description: liquorBrands.description,
      logoUrl: liquorBrands.logoUrl,
      isActive: liquorBrands.isActive,
      createdAt: liquorBrands.createdAt,
      updatedAt: liquorBrands.updatedAt,
      productCount: count(liquorProducts.id),
    })
    .from(liquorBrands)
    .leftJoin(liquorProducts, eq(liquorBrands.id, liquorProducts.brandId))
    .groupBy(liquorBrands.id)
    .orderBy(asc(liquorBrands.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_liquor_brands', result, 60_000)
}

export async function getFoodBrandsQuery() {
  const cached = getCatalogCached<any[]>('food_brands')
  if (cached) return cached

  const rows = await db
    .select()
    .from(foodBrands)
    .where(eq(foodBrands.isActive, true))
    .orderBy(asc(foodBrands.name))

  return setCatalogCached('food_brands', rows, 60_000)
}

export async function getAllFoodBrandsQuery() {
  const cached = getCatalogCached<any[]>('all_food_brands')
  if (cached) return cached

  const rows = await db
    .select({
      id: foodBrands.id,
      name: foodBrands.name,
      slug: foodBrands.slug,
      origin: foodBrands.origin,
      description: foodBrands.description,
      logoUrl: foodBrands.logoUrl,
      isActive: foodBrands.isActive,
      createdAt: foodBrands.createdAt,
      updatedAt: foodBrands.updatedAt,
      productCount: count(foodProducts.id),
    })
    .from(foodBrands)
    .leftJoin(foodProducts, eq(foodBrands.id, foodProducts.brandId))
    .groupBy(foodBrands.id)
    .orderBy(asc(foodBrands.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_food_brands', result, 60_000)
}

export async function getGroceryBrandsQuery() {
  const cached = getCatalogCached<any[]>('grocery_brands')
  if (cached) return cached

  const rows = await db
    .select()
    .from(groceryBrands)
    .where(eq(groceryBrands.isActive, true))
    .orderBy(asc(groceryBrands.name))

  return setCatalogCached('grocery_brands', rows, 60_000)
}

export async function getAllGroceryBrandsQuery() {
  const cached = getCatalogCached<any[]>('all_grocery_brands')
  if (cached) return cached

  const rows = await db
    .select({
      id: groceryBrands.id,
      name: groceryBrands.name,
      slug: groceryBrands.slug,
      origin: groceryBrands.origin,
      description: groceryBrands.description,
      logoUrl: groceryBrands.logoUrl,
      isActive: groceryBrands.isActive,
      createdAt: groceryBrands.createdAt,
      updatedAt: groceryBrands.updatedAt,
      productCount: count(groceryProducts.id),
    })
    .from(groceryBrands)
    .leftJoin(groceryProducts, eq(groceryBrands.id, groceryProducts.brandId))
    .groupBy(groceryBrands.id)
    .orderBy(asc(groceryBrands.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_grocery_brands', result, 60_000)
}

export async function getDdcBrandsQuery() {
  const cached = getCatalogCached<any[]>('ddc_brands')
  if (cached) return cached

  const rows = await db
    .select()
    .from(ddcBrands)
    .where(eq(ddcBrands.isActive, true))
    .orderBy(asc(ddcBrands.name))

  return setCatalogCached('ddc_brands', rows, 60_000)
}

export async function getAllDdcBrandsQuery() {
  const cached = getCatalogCached<any[]>('all_ddc_brands')
  if (cached) return cached

  const rows = await db
    .select({
      id: ddcBrands.id,
      name: ddcBrands.name,
      slug: ddcBrands.slug,
      origin: ddcBrands.origin,
      description: ddcBrands.description,
      logoUrl: ddcBrands.logoUrl,
      isActive: ddcBrands.isActive,
      createdAt: ddcBrands.createdAt,
      updatedAt: ddcBrands.updatedAt,
      productCount: count(ddcProducts.id),
    })
    .from(ddcBrands)
    .leftJoin(ddcProducts, eq(ddcBrands.id, ddcProducts.brandId))
    .groupBy(ddcBrands.id)
    .orderBy(asc(ddcBrands.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_ddc_brands', result, 60_000)
}

export async function getLiquorProductsQuery(input: ListLiquorInput) {
  const conditions = [eq(liquorProducts.isActive, true)]

  if (input.categorySlug) {
    conditions.push(eq(liquorCategories.slug, input.categorySlug))
  }

  if (input.brandSlug) {
    conditions.push(eq(liquorBrands.slug, input.brandSlug))
  }

  if (input.isFeatured !== undefined) {
    conditions.push(eq(liquorProducts.isFeatured, input.isFeatured))
  }

  if (input.query) {
    conditions.push(
      or(
        ilike(liquorProducts.name, `%${input.query}%`),
        ilike(liquorProducts.description, `%${input.query}%`),
      )!,
    )
  }

  const productsList = await db
    .select({
      id: liquorProducts.id,
      name: liquorProducts.name,
      slug: liquorProducts.slug,
      description: liquorProducts.description,
      isFeatured: liquorProducts.isFeatured,
      customBadge: liquorProducts.customBadge,
      customDiscountLabel: liquorProducts.customDiscountLabel,
      categoryName: liquorCategories.name,
      categorySlug: liquorCategories.slug,
      brandName: liquorBrands.name,
      brandSlug: liquorBrands.slug,
    })
    .from(liquorProducts)
    .innerJoin(
      liquorCategories,
      eq(liquorProducts.categoryId, liquorCategories.id),
    )
    .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))
    .where(and(...conditions))
    .limit(input.limit)
    .offset(input.offset)

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)

  const [variants, images] = await Promise.all([
    db
      .select()
      .from(liquorVariants)
      .where(
        and(
          eq(liquorVariants.isActive, true),
          inArray(liquorVariants.productId, productIds),
        ),
      ),
    db
      .select()
      .from(liquorImages)
      .where(inArray(liquorImages.productId, productIds)),
  ])

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
  }

  return productsList.map((p) => ({
    ...p,
    catalogType: 'liquor' as const,
    primaryImage: imagesMap.get(p.id) ?? null,
    variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
  }))
}

export async function getFoodCategoriesQuery() {
  const cached = getCatalogCached<any[]>('food_categories')
  if (cached) return cached

  const rows = await db
    .select()
    .from(foodCategories)
    .where(eq(foodCategories.isActive, true))
    .orderBy(asc(foodCategories.sortOrder), asc(foodCategories.name))

  return setCatalogCached('food_categories', rows, 60_000)
}

export async function getAllFoodCategoriesQuery() {
  const cached = getCatalogCached<any[]>('all_food_categories')
  if (cached) return cached

  const rows = await db
    .select({
      id: foodCategories.id,
      name: foodCategories.name,
      slug: foodCategories.slug,
      description: foodCategories.description,
      imageUrl: foodCategories.imageUrl,
      sortOrder: foodCategories.sortOrder,
      isActive: foodCategories.isActive,
      showOnLandingPage: foodCategories.showOnLandingPage,
      createdAt: foodCategories.createdAt,
      updatedAt: foodCategories.updatedAt,
      productCount: count(foodProducts.id),
    })
    .from(foodCategories)
    .leftJoin(
      foodProducts,
      eq(foodCategories.id, foodProducts.categoryId),
    )
    .groupBy(foodCategories.id)
    .orderBy(asc(foodCategories.sortOrder), asc(foodCategories.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_food_categories', result, 60_000)
}

export async function getFoodProductsQuery(input: ListFoodInput) {
  const conditions = [eq(foodProducts.isActive, true)]

  if (input.categorySlug) {
    conditions.push(eq(foodCategories.slug, input.categorySlug))
  }

  if (input.isFeatured !== undefined) {
    conditions.push(eq(foodProducts.isFeatured, input.isFeatured))
  }

  if (input.query) {
    conditions.push(
      or(
        ilike(foodProducts.name, `%${input.query}%`),
        ilike(foodProducts.description, `%${input.query}%`),
      )!,
    )
  }

  const productsList = await db
    .select({
      id: foodProducts.id,
      name: foodProducts.name,
      slug: foodProducts.slug,
      description: foodProducts.description,
      isFeatured: foodProducts.isFeatured,
      customBadge: foodProducts.customBadge,
      customDiscountLabel: foodProducts.customDiscountLabel,
      categoryName: foodCategories.name,
      categorySlug: foodCategories.slug,
    })
    .from(foodProducts)
    .innerJoin(
      foodCategories,
      eq(foodProducts.categoryId, foodCategories.id),
    )
    .where(and(...conditions))
    .limit(input.limit)
    .offset(input.offset)

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)

  const [variants, images] = await Promise.all([
    db
      .select()
      .from(foodVariants)
      .where(
        and(
          eq(foodVariants.isActive, true),
          inArray(foodVariants.productId, productIds),
        ),
      ),
    db
      .select()
      .from(foodImages)
      .where(inArray(foodImages.productId, productIds)),
  ])

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
  }

  return productsList.map((p) => ({
    ...p,
    catalogType: 'food' as const,
    primaryImage: imagesMap.get(p.id) ?? null,
    variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
  }))
}

export async function getGroceryCategoriesQuery() {
  const cached = getCatalogCached<any[]>('grocery_categories')
  if (cached) return cached

  const rows = await db
    .select()
    .from(groceryCategories)
    .where(eq(groceryCategories.isActive, true))
    .orderBy(asc(groceryCategories.sortOrder), asc(groceryCategories.name))

  return setCatalogCached('grocery_categories', rows, 60_000)
}

export async function getAllGroceryCategoriesQuery() {
  const cached = getCatalogCached<any[]>('all_grocery_categories')
  if (cached) return cached

  const rows = await db
    .select({
      id: groceryCategories.id,
      name: groceryCategories.name,
      slug: groceryCategories.slug,
      description: groceryCategories.description,
      imageUrl: groceryCategories.imageUrl,
      sortOrder: groceryCategories.sortOrder,
      isActive: groceryCategories.isActive,
      showOnLandingPage: groceryCategories.showOnLandingPage,
      createdAt: groceryCategories.createdAt,
      updatedAt: groceryCategories.updatedAt,
      productCount: count(groceryProducts.id),
    })
    .from(groceryCategories)
    .leftJoin(
      groceryProducts,
      eq(groceryCategories.id, groceryProducts.categoryId),
    )
    .groupBy(groceryCategories.id)
    .orderBy(asc(groceryCategories.sortOrder), asc(groceryCategories.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_grocery_categories', result, 60_000)
}

export async function getGroceryProductsQuery(input: ListGroceryInput) {
  const conditions = [eq(groceryProducts.isActive, true)]

  if (input.categorySlug) {
    conditions.push(eq(groceryCategories.slug, input.categorySlug))
  }

  if (input.isFeatured !== undefined) {
    conditions.push(eq(groceryProducts.isFeatured, input.isFeatured))
  }

  if (input.query) {
    conditions.push(
      or(
        ilike(groceryProducts.name, `%${input.query}%`),
        ilike(groceryProducts.description, `%${input.query}%`),
      )!,
    )
  }

  const productsList = await db
    .select({
      id: groceryProducts.id,
      name: groceryProducts.name,
      slug: groceryProducts.slug,
      description: groceryProducts.description,
      isFeatured: groceryProducts.isFeatured,
      customBadge: groceryProducts.customBadge,
      customDiscountLabel: groceryProducts.customDiscountLabel,
      categoryName: groceryCategories.name,
      categorySlug: groceryCategories.slug,
    })
    .from(groceryProducts)
    .innerJoin(
      groceryCategories,
      eq(groceryProducts.categoryId, groceryCategories.id),
    )
    .where(and(...conditions))
    .limit(input.limit)
    .offset(input.offset)

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)

  const [variants, images] = await Promise.all([
    db
      .select()
      .from(groceryVariants)
      .where(
        and(
          eq(groceryVariants.isActive, true),
          inArray(groceryVariants.productId, productIds),
        ),
      ),
    db
      .select()
      .from(groceryImages)
      .where(inArray(groceryImages.productId, productIds)),
  ])

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
  }

  return productsList.map((p) => ({
    ...p,
    catalogType: 'grocery' as const,
    primaryImage: imagesMap.get(p.id) ?? null,
    variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
  }))
}

export async function getDdcCategoriesQuery() {
  const cached = getCatalogCached<any[]>('ddc_categories')
  if (cached) return cached

  const rows = await db
    .select()
    .from(ddcCategories)
    .where(eq(ddcCategories.isActive, true))
    .orderBy(asc(ddcCategories.sortOrder), asc(ddcCategories.name))

  return setCatalogCached('ddc_categories', rows, 60_000)
}

export async function getAllDdcCategoriesQuery() {
  const cached = getCatalogCached<any[]>('all_ddc_categories')
  if (cached) return cached

  const rows = await db
    .select({
      id: ddcCategories.id,
      name: ddcCategories.name,
      slug: ddcCategories.slug,
      description: ddcCategories.description,
      imageUrl: ddcCategories.imageUrl,
      sortOrder: ddcCategories.sortOrder,
      isActive: ddcCategories.isActive,
      showOnLandingPage: ddcCategories.showOnLandingPage,
      createdAt: ddcCategories.createdAt,
      updatedAt: ddcCategories.updatedAt,
      productCount: count(ddcProducts.id),
    })
    .from(ddcCategories)
    .leftJoin(
      ddcProducts,
      eq(ddcCategories.id, ddcProducts.categoryId),
    )
    .groupBy(ddcCategories.id)
    .orderBy(asc(ddcCategories.sortOrder), asc(ddcCategories.name))

  const result = rows.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))

  return setCatalogCached('all_ddc_categories', result, 60_000)
}

export async function getDdcProductsQuery(input: ListDdcInput) {
  const conditions = [eq(ddcProducts.isActive, true)]

  if (input.categorySlug) {
    conditions.push(eq(ddcCategories.slug, input.categorySlug))
  }

  if (input.isFeatured !== undefined) {
    conditions.push(eq(ddcProducts.isFeatured, input.isFeatured))
  }

  if (input.query) {
    conditions.push(
      or(
        ilike(ddcProducts.name, `%${input.query}%`),
        ilike(ddcProducts.description, `%${input.query}%`),
      )!,
    )
  }

  const productsList = await db
    .select({
      id: ddcProducts.id,
      name: ddcProducts.name,
      slug: ddcProducts.slug,
      description: ddcProducts.description,
      isFeatured: ddcProducts.isFeatured,
      customBadge: ddcProducts.customBadge,
      customDiscountLabel: ddcProducts.customDiscountLabel,
      categoryName: ddcCategories.name,
      categorySlug: ddcCategories.slug,
    })
    .from(ddcProducts)
    .innerJoin(
      ddcCategories,
      eq(ddcProducts.categoryId, ddcCategories.id),
    )
    .where(and(...conditions))
    .limit(input.limit)
    .offset(input.offset)

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)

  const [variants, images] = await Promise.all([
    db
      .select()
      .from(ddcVariants)
      .where(
        and(
          eq(ddcVariants.isActive, true),
          inArray(ddcVariants.productId, productIds),
        ),
      ),
    db
      .select()
      .from(ddcImages)
      .where(inArray(ddcImages.productId, productIds)),
  ])

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
  }

  return productsList.map((p) => ({
    ...p,
    catalogType: 'ddc' as const,
    primaryImage: imagesMap.get(p.id) ?? null,
    variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
  }))
}

// -------------------------------------------------------------
// ADMIN QUERIES
// -------------------------------------------------------------

export async function getAdminStatsQuery() {
  const [
    liquorRes,
    foodRes,
    brandRes,
    foodBrandRes,
    liquorCatRes,
    foodCatRes,
    userRes,
    customersRes,
    liqStockRes,
    foodStockRes,
    liqValRes,
    foodValRes,
    liqLowRes,
    foodLowRes,
  ] = await Promise.all([
    db.select({ total: count() }).from(liquorProducts),
    db.select({ total: count() }).from(foodProducts),
    db.select({ total: count() }).from(liquorBrands),
    db.select({ total: count() }).from(foodBrands),
    db.select({ total: count() }).from(liquorCategories),
    db.select({ total: count() }).from(foodCategories),
    db.select({ total: count() }).from(user),
    db
      .select({ total: count() })
      .from(user)
      .where(
        or(isNull(user.role), eq(user.role, 'customer'), eq(user.role, 'user')),
      ),
    db.select({ totalStock: sum(liquorVariants.stock) }).from(liquorVariants),
    db.select({ totalStock: sum(foodVariants.stock) }).from(foodVariants),
    db
      .select({
        totalValue: sql<string>`coalesce(sum(${liquorVariants.price} * ${liquorVariants.stock}), 0)`,
      })
      .from(liquorVariants),
    db
      .select({
        totalValue: sql<string>`coalesce(sum(${foodVariants.price} * ${foodVariants.stock}), 0)`,
      })
      .from(foodVariants),
    db
      .select({ lowStock: count() })
      .from(liquorVariants)
      .where(lte(liquorVariants.stock, 20)),
    db
      .select({ lowStock: count() })
      .from(foodVariants)
      .where(lte(foodVariants.stock, 20)),
  ])

  const totalStockLiquor = Number(liqStockRes[0]?.totalStock ?? 0)
  const totalStockFood = Number(foodStockRes[0]?.totalStock ?? 0)
  const totalValueLiquor = Number(liqValRes[0]?.totalValue ?? 0)
  const totalValueFood = Number(foodValRes[0]?.totalValue ?? 0)
  const lowStockCount =
    (liqLowRes[0]?.lowStock ?? 0) + (foodLowRes[0]?.lowStock ?? 0)

  return {
    totalLiquorProducts: liquorRes[0]?.total ?? 0,
    totalFoodProducts: foodRes[0]?.total ?? 0,
    totalBrands: (brandRes[0]?.total ?? 0) + (foodBrandRes[0]?.total ?? 0),
    totalCategories:
      (liquorCatRes[0]?.total ?? 0) + (foodCatRes[0]?.total ?? 0),
    totalUsers: userRes[0]?.total ?? 0,
    totalCustomers: customersRes[0]?.total ?? 0,
    totalStockUnits: totalStockLiquor + totalStockFood,
    totalInventoryValue: totalValueLiquor + totalValueFood,
    lowStockCount,
  }
}

export async function getAdminLiquorProductsQuery() {
  const productsList = await db
    .select({
      id: liquorProducts.id,
      name: liquorProducts.name,
      slug: liquorProducts.slug,
      description: liquorProducts.description,
      isFeatured: liquorProducts.isFeatured,
      customBadge: liquorProducts.customBadge,
      customDiscountLabel: liquorProducts.customDiscountLabel,
      isActive: liquorProducts.isActive,
      categoryId: liquorProducts.categoryId,
      brandId: liquorProducts.brandId,
      createdAt: liquorProducts.createdAt,
      categoryName: liquorCategories.name,
      categorySlug: liquorCategories.slug,
      brandName: liquorBrands.name,
      brandSlug: liquorBrands.slug,
    })
    .from(liquorProducts)
    .innerJoin(
      liquorCategories,
      eq(liquorProducts.categoryId, liquorCategories.id),
    )
    .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))
    .orderBy(desc(liquorProducts.createdAt))

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)
  const [variants, images, assignedDealerRows] = await Promise.all([
    db
      .select()
      .from(liquorVariants)
      .where(inArray(liquorVariants.productId, productIds)),
    db
      .select()
      .from(liquorImages)
      .where(inArray(liquorImages.productId, productIds)),
    db
      .select({
        productId: dealerItems.productId,
        dealerId: dealers.id,
        dealerName: dealers.name,
      })
      .from(dealerItems)
      .innerJoin(dealers, eq(dealerItems.dealerId, dealers.id))
      .where(
        and(
          eq(dealerItems.catalogType, 'liquor'),
          inArray(dealerItems.productId, productIds),
        ),
      ),
  ])

  const dealersMap = new Map<string, { id: string; name: string }[]>()
  for (const row of assignedDealerRows) {
    const list = dealersMap.get(row.productId) ?? []
    list.push({ id: row.dealerId, name: row.dealerName })
    dealersMap.set(row.productId, list)
  }

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  const allImagesMap = new Map<string, typeof images>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
    const current = allImagesMap.get(img.productId) ?? []
    current.push(img)
    allImagesMap.set(img.productId, current)
  }

  return productsList.map((p) => {
    const assigned = dealersMap.get(p.id) ?? []
    return {
      ...p,
      catalogType: 'liquor' as const,
      primaryImage: imagesMap.get(p.id) ?? null,
      images: (allImagesMap.get(p.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
      variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
      dealers: assigned,
      dealerIds: assigned.map((d) => d.id),
    }
  })
}

export async function getAdminFoodProductsQuery() {
  const productsList = await db
    .select({
      id: foodProducts.id,
      name: foodProducts.name,
      slug: foodProducts.slug,
      description: foodProducts.description,
      isFeatured: foodProducts.isFeatured,
      customBadge: foodProducts.customBadge,
      customDiscountLabel: foodProducts.customDiscountLabel,
      isActive: foodProducts.isActive,
      categoryId: foodProducts.categoryId,
      brandId: foodProducts.brandId,
      createdAt: foodProducts.createdAt,
      categoryName: foodCategories.name,
      categorySlug: foodCategories.slug,
      brandName: foodBrands.name,
      brandSlug: foodBrands.slug,
    })
    .from(foodProducts)
    .innerJoin(
      foodCategories,
      eq(foodProducts.categoryId, foodCategories.id),
    )
    .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id))
    .orderBy(desc(foodProducts.createdAt))

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)
  const [variants, images, assignedDealerRows] = await Promise.all([
    db
      .select()
      .from(foodVariants)
      .where(inArray(foodVariants.productId, productIds)),
    db
      .select()
      .from(foodImages)
      .where(inArray(foodImages.productId, productIds)),
    db
      .select({
        productId: dealerItems.productId,
        dealerId: dealers.id,
        dealerName: dealers.name,
      })
      .from(dealerItems)
      .innerJoin(dealers, eq(dealerItems.dealerId, dealers.id))
      .where(
        and(
          eq(dealerItems.catalogType, 'food'),
          inArray(dealerItems.productId, productIds),
        ),
      ),
  ])

  const dealersMap = new Map<string, { id: string; name: string }[]>()
  for (const row of assignedDealerRows) {
    const list = dealersMap.get(row.productId) ?? []
    list.push({ id: row.dealerId, name: row.dealerName })
    dealersMap.set(row.productId, list)
  }

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  const allImagesMap = new Map<string, typeof images>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
    const current = allImagesMap.get(img.productId) ?? []
    current.push(img)
    allImagesMap.set(img.productId, current)
  }

  return productsList.map((p) => {
    const assigned = dealersMap.get(p.id) ?? []
    return {
      ...p,
      catalogType: 'food' as const,
      primaryImage: imagesMap.get(p.id) ?? null,
      images: (allImagesMap.get(p.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
      variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
      dealers: assigned,
      dealerIds: assigned.map((d) => d.id),
    }
  })
}

export async function getAdminGroceryProductsQuery() {
  const productsList = await db
    .select({
      id: groceryProducts.id,
      name: groceryProducts.name,
      slug: groceryProducts.slug,
      description: groceryProducts.description,
      isFeatured: groceryProducts.isFeatured,
      customBadge: groceryProducts.customBadge,
      customDiscountLabel: groceryProducts.customDiscountLabel,
      isActive: groceryProducts.isActive,
      categoryId: groceryProducts.categoryId,
      brandId: groceryProducts.brandId,
      createdAt: groceryProducts.createdAt,
      categoryName: groceryCategories.name,
      categorySlug: groceryCategories.slug,
      brandName: groceryBrands.name,
      brandSlug: groceryBrands.slug,
    })
    .from(groceryProducts)
    .innerJoin(
      groceryCategories,
      eq(groceryProducts.categoryId, groceryCategories.id),
    )
    .leftJoin(groceryBrands, eq(groceryProducts.brandId, groceryBrands.id))
    .orderBy(desc(groceryProducts.createdAt))

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)
  const [variants, images, assignedDealerRows] = await Promise.all([
    db
      .select()
      .from(groceryVariants)
      .where(inArray(groceryVariants.productId, productIds)),
    db
      .select()
      .from(groceryImages)
      .where(inArray(groceryImages.productId, productIds)),
    db
      .select({
        productId: dealerItems.productId,
        dealerId: dealers.id,
        dealerName: dealers.name,
      })
      .from(dealerItems)
      .innerJoin(dealers, eq(dealerItems.dealerId, dealers.id))
      .where(
        and(
          eq(dealerItems.catalogType, 'grocery'),
          inArray(dealerItems.productId, productIds),
        ),
      ),
  ])

  const dealersMap = new Map<string, { id: string; name: string }[]>()
  for (const row of assignedDealerRows) {
    const list = dealersMap.get(row.productId) ?? []
    list.push({ id: row.dealerId, name: row.dealerName })
    dealersMap.set(row.productId, list)
  }

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  const allImagesMap = new Map<string, typeof images>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
    const current = allImagesMap.get(img.productId) ?? []
    current.push(img)
    allImagesMap.set(img.productId, current)
  }

  return productsList.map((p) => {
    const assigned = dealersMap.get(p.id) ?? []
    return {
      ...p,
      catalogType: 'grocery' as const,
      primaryImage: imagesMap.get(p.id) ?? null,
      images: (allImagesMap.get(p.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
      variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
      dealers: assigned,
      dealerIds: assigned.map((d) => d.id),
    }
  })
}

export async function getAdminDdcProductsQuery() {
  const productsList = await db
    .select({
      id: ddcProducts.id,
      name: ddcProducts.name,
      slug: ddcProducts.slug,
      description: ddcProducts.description,
      isFeatured: ddcProducts.isFeatured,
      customBadge: ddcProducts.customBadge,
      customDiscountLabel: ddcProducts.customDiscountLabel,
      isActive: ddcProducts.isActive,
      categoryId: ddcProducts.categoryId,
      brandId: ddcProducts.brandId,
      createdAt: ddcProducts.createdAt,
      categoryName: ddcCategories.name,
      categorySlug: ddcCategories.slug,
      brandName: ddcBrands.name,
      brandSlug: ddcBrands.slug,
    })
    .from(ddcProducts)
    .innerJoin(
      ddcCategories,
      eq(ddcProducts.categoryId, ddcCategories.id),
    )
    .leftJoin(ddcBrands, eq(ddcProducts.brandId, ddcBrands.id))
    .orderBy(desc(ddcProducts.createdAt))

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)
  const [variants, images, assignedDealerRows] = await Promise.all([
    db
      .select()
      .from(ddcVariants)
      .where(inArray(ddcVariants.productId, productIds)),
    db
      .select()
      .from(ddcImages)
      .where(inArray(ddcImages.productId, productIds)),
    db
      .select({
        productId: dealerItems.productId,
        dealerId: dealers.id,
        dealerName: dealers.name,
      })
      .from(dealerItems)
      .innerJoin(dealers, eq(dealerItems.dealerId, dealers.id))
      .where(
        and(
          eq(dealerItems.catalogType, 'ddc'),
          inArray(dealerItems.productId, productIds),
        ),
      ),
  ])

  const dealersMap = new Map<string, { id: string; name: string }[]>()
  for (const row of assignedDealerRows) {
    const list = dealersMap.get(row.productId) ?? []
    list.push({ id: row.dealerId, name: row.dealerName })
    dealersMap.set(row.productId, list)
  }

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  const allImagesMap = new Map<string, typeof images>()
  for (const img of images) {
    if (img.isPrimary || !imagesMap.has(img.productId)) {
      imagesMap.set(img.productId, img.url)
    }
    const current = allImagesMap.get(img.productId) ?? []
    current.push(img)
    allImagesMap.set(img.productId, current)
  }

  return productsList.map((p) => {
    const assigned = dealersMap.get(p.id) ?? []
    return {
      ...p,
      catalogType: 'ddc' as const,
      primaryImage: imagesMap.get(p.id) ?? null,
      images: (allImagesMap.get(p.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
      variants: (variantsMap.get(p.id) ?? []).sort((a, b) => a.price - b.price),
      dealers: assigned,
      dealerIds: assigned.map((d) => d.id),
    }
  })
}

export async function upsertLiquorProductQuery(
  input: UpsertLiquorProductInput,
  externalTx?: DbTx,
) {
  const run = async (tx: DbTx) => {
    const slug = input.slug?.trim() || slugify(input.name)

    let productId = input.id

    if (productId) {
      await tx
        .update(liquorProducts)
        .set({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .where(eq(liquorProducts.id, productId))
    } else {
      const [inserted] = await tx
        .insert(liquorProducts)
        .values({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .returning({ id: liquorProducts.id })
      productId = inserted.id
    }

    if (input.images !== undefined) {
      await tx.delete(liquorImages).where(eq(liquorImages.productId, productId))
      if (input.images.length > 0) {
        await tx.insert(liquorImages).values(
          input.images.map((img) => ({
            productId,
            url: img.url,
            alt: img.alt ?? input.name,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        )
      }
    } else if (input.imageUrl) {
      const existingImg = await tx
        .select({ id: liquorImages.id })
        .from(liquorImages)
        .where(eq(liquorImages.productId, productId))
        .limit(1)

      if (existingImg.length > 0) {
        await tx
          .update(liquorImages)
          .set({ url: input.imageUrl, alt: input.name, isPrimary: true })
          .where(eq(liquorImages.id, existingImg[0].id))
      } else {
        await tx.insert(liquorImages).values({
          productId,
          url: input.imageUrl,
          alt: input.name,
          isPrimary: true,
        })
      }
    }

    if (input.id) {
      const keptVariantIds = input.variants
        .map((v) => v.id)
        .filter((id): id is string => Boolean(id))

      if (keptVariantIds.length > 0) {
        const removedVariants = await tx
          .select({ id: liquorVariants.id })
          .from(liquorVariants)
          .where(
            and(
              eq(liquorVariants.productId, productId),
              notInArray(liquorVariants.id, keptVariantIds),
            ),
          )
        const removedIds = removedVariants.map((v) => v.id)
        if (removedIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'liquor'),
                inArray(dealerStock.variantId, removedIds),
              ),
            )
          await tx
            .delete(liquorVariants)
            .where(inArray(liquorVariants.id, removedIds))
        }
      }
    }

    for (const v of input.variants) {
      if (v.id) {
        await tx
          .update(liquorVariants)
          .set({
            name: v.name,
            volumeMl: v.volumeMl,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            abv: v.abv ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .where(eq(liquorVariants.id, v.id))
      } else {
        await tx
          .insert(liquorVariants)
          .values({
            productId,
            name: v.name,
            volumeMl: v.volumeMl,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            abv: v.abv ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .onConflictDoUpdate({
            target: liquorVariants.sku,
            set: {
              name: v.name,
              volumeMl: v.volumeMl,
              price: v.price,
              mrp: v.mrp ?? null,
              abv: v.abv ?? null,
              stock: v.stock,
              isActive: v.isActive,
            },
          })
      }
    }

    if (input.dealerIds !== undefined) {
      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'liquor'),
            eq(dealerItems.productId, productId),
          ),
        )
      if (input.dealerIds.length > 0) {
        const uniqueDealers = Array.from(new Set(input.dealerIds))
        await tx.insert(dealerItems).values(
          uniqueDealers.map((dealerId) => ({
            id: crypto.randomUUID(),
            dealerId,
            catalogType: 'liquor',
            productId,
          })),
        )
      }
    }

    return { success: true, productId }
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function upsertFoodProductQuery(
  input: UpsertFoodProductInput,
  externalTx?: DbTx,
) {
  const run = async (tx: DbTx) => {
    const slug = input.slug?.trim() || slugify(input.name)

    let productId = input.id

    if (productId) {
      await tx
        .update(foodProducts)
        .set({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .where(eq(foodProducts.id, productId))
    } else {
      const [inserted] = await tx
        .insert(foodProducts)
        .values({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .returning({ id: foodProducts.id })
      productId = inserted.id
    }

    if (input.images !== undefined) {
      await tx
        .delete(foodImages)
        .where(eq(foodImages.productId, productId))
      if (input.images.length > 0) {
        await tx.insert(foodImages).values(
          input.images.map((img) => ({
            productId,
            url: img.url,
            alt: img.alt ?? input.name,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        )
      }
    } else if (input.imageUrl) {
      const existingImg = await tx
        .select({ id: foodImages.id })
        .from(foodImages)
        .where(eq(foodImages.productId, productId))
        .limit(1)

      if (existingImg.length > 0) {
        await tx
          .update(foodImages)
          .set({ url: input.imageUrl, alt: input.name, isPrimary: true })
          .where(eq(foodImages.id, existingImg[0].id))
      } else {
        await tx.insert(foodImages).values({
          productId,
          url: input.imageUrl,
          alt: input.name,
          isPrimary: true,
        })
      }
    }

    if (input.id) {
      const keptVariantIds = input.variants
        .map((v) => v.id)
        .filter((id): id is string => Boolean(id))

      if (keptVariantIds.length > 0) {
        const removedVariants = await tx
          .select({ id: foodVariants.id })
          .from(foodVariants)
          .where(
            and(
              eq(foodVariants.productId, productId),
              notInArray(foodVariants.id, keptVariantIds),
            ),
          )
        const removedIds = removedVariants.map((v) => v.id)
        if (removedIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'food'),
                inArray(dealerStock.variantId, removedIds),
              ),
            )
          await tx
            .delete(foodVariants)
            .where(inArray(foodVariants.id, removedIds))
        }
      }
    }

    for (const v of input.variants) {
      if (v.id) {
        await tx
          .update(foodVariants)
          .set({
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .where(eq(foodVariants.id, v.id))
      } else {
        await tx
          .insert(foodVariants)
          .values({
            productId,
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .onConflictDoUpdate({
            target: foodVariants.sku,
            set: {
              name: v.name,
              unit: v.unit,
              quantity: v.quantity,
              price: v.price,
              mrp: v.mrp ?? null,
              stock: v.stock,
              isActive: v.isActive,
            },
          })
      }
    }

    if (input.dealerIds !== undefined) {
      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'food'),
            eq(dealerItems.productId, productId),
          ),
        )
      if (input.dealerIds.length > 0) {
        const uniqueDealers = Array.from(new Set(input.dealerIds))
        await tx.insert(dealerItems).values(
          uniqueDealers.map((dealerId) => ({
            id: crypto.randomUUID(),
            dealerId,
            catalogType: 'food',
            productId,
          })),
        )
      }
    }

    return { success: true, productId }
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function upsertGroceryProductQuery(
  input: UpsertGroceryProductInput,
  externalTx?: DbTx,
) {
  const run = async (tx: DbTx) => {
    const slug = input.slug?.trim() || slugify(input.name)

    let productId = input.id

    if (productId) {
      await tx
        .update(groceryProducts)
        .set({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .where(eq(groceryProducts.id, productId))
    } else {
      const [inserted] = await tx
        .insert(groceryProducts)
        .values({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .returning({ id: groceryProducts.id })
      productId = inserted.id
    }

    if (input.images !== undefined) {
      await tx
        .delete(groceryImages)
        .where(eq(groceryImages.productId, productId))
      if (input.images.length > 0) {
        await tx.insert(groceryImages).values(
          input.images.map((img) => ({
            productId,
            url: img.url,
            alt: img.alt ?? input.name,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        )
      }
    } else if (input.imageUrl) {
      const existingImg = await tx
        .select({ id: groceryImages.id })
        .from(groceryImages)
        .where(eq(groceryImages.productId, productId))
        .limit(1)

      if (existingImg.length > 0) {
        await tx
          .update(groceryImages)
          .set({ url: input.imageUrl, alt: input.name, isPrimary: true })
          .where(eq(groceryImages.id, existingImg[0].id))
      } else {
        await tx.insert(groceryImages).values({
          productId,
          url: input.imageUrl,
          alt: input.name,
          isPrimary: true,
        })
      }
    }

    if (input.id) {
      const keptVariantIds = input.variants
        .map((v) => v.id)
        .filter((id): id is string => Boolean(id))

      if (keptVariantIds.length > 0) {
        const removedVariants = await tx
          .select({ id: groceryVariants.id })
          .from(groceryVariants)
          .where(
            and(
              eq(groceryVariants.productId, productId),
              notInArray(groceryVariants.id, keptVariantIds),
            ),
          )
        const removedIds = removedVariants.map((v) => v.id)
        if (removedIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'grocery'),
                inArray(dealerStock.variantId, removedIds),
              ),
            )
          await tx
            .delete(groceryVariants)
            .where(inArray(groceryVariants.id, removedIds))
        }
      }
    }

    for (const v of input.variants) {
      if (v.id) {
        await tx
          .update(groceryVariants)
          .set({
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .where(eq(groceryVariants.id, v.id))
      } else {
        await tx
          .insert(groceryVariants)
          .values({
            productId,
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .onConflictDoUpdate({
            target: groceryVariants.sku,
            set: {
              name: v.name,
              unit: v.unit,
              quantity: v.quantity,
              price: v.price,
              mrp: v.mrp ?? null,
              stock: v.stock,
              isActive: v.isActive,
            },
          })
      }
    }

    if (input.dealerIds !== undefined) {
      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'grocery'),
            eq(dealerItems.productId, productId),
          ),
        )
      if (input.dealerIds.length > 0) {
        const uniqueDealers = Array.from(new Set(input.dealerIds))
        await tx.insert(dealerItems).values(
          uniqueDealers.map((dealerId) => ({
            id: crypto.randomUUID(),
            dealerId,
            catalogType: 'grocery',
            productId,
          })),
        )
      }
    }

    return { success: true, productId }
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function upsertDdcProductQuery(
  input: UpsertDdcProductInput,
  externalTx?: DbTx,
) {
  const run = async (tx: DbTx) => {
    const slug = input.slug?.trim() || slugify(input.name)

    let productId = input.id

    if (productId) {
      await tx
        .update(ddcProducts)
        .set({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .where(eq(ddcProducts.id, productId))
    } else {
      const [inserted] = await tx
        .insert(ddcProducts)
        .values({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          description: input.description ?? null,
          isFeatured: input.isFeatured,
          customBadge: input.customBadge ?? null,
          customDiscountLabel: input.customDiscountLabel ?? null,
          isActive: input.isActive,
        })
        .returning({ id: ddcProducts.id })
      productId = inserted.id
    }

    if (input.images !== undefined) {
      await tx
        .delete(ddcImages)
        .where(eq(ddcImages.productId, productId))
      if (input.images.length > 0) {
        await tx.insert(ddcImages).values(
          input.images.map((img) => ({
            productId,
            url: img.url,
            alt: img.alt ?? input.name,
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
          })),
        )
      }
    } else if (input.imageUrl) {
      const existingImg = await tx
        .select({ id: ddcImages.id })
        .from(ddcImages)
        .where(eq(ddcImages.productId, productId))
        .limit(1)

      if (existingImg.length > 0) {
        await tx
          .update(ddcImages)
          .set({ url: input.imageUrl, alt: input.name, isPrimary: true })
          .where(eq(ddcImages.id, existingImg[0].id))
      } else {
        await tx.insert(ddcImages).values({
          productId,
          url: input.imageUrl,
          alt: input.name,
          isPrimary: true,
        })
      }
    }

    if (input.id) {
      const keptVariantIds = input.variants
        .map((v) => v.id)
        .filter((id): id is string => Boolean(id))

      if (keptVariantIds.length > 0) {
        const removedVariants = await tx
          .select({ id: ddcVariants.id })
          .from(ddcVariants)
          .where(
            and(
              eq(ddcVariants.productId, productId),
              notInArray(ddcVariants.id, keptVariantIds),
            ),
          )
        const removedIds = removedVariants.map((v) => v.id)
        if (removedIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'ddc'),
                inArray(dealerStock.variantId, removedIds),
              ),
            )
          await tx
            .delete(ddcVariants)
            .where(inArray(ddcVariants.id, removedIds))
        }
      }
    }

    for (const v of input.variants) {
      if (v.id) {
        await tx
          .update(ddcVariants)
          .set({
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .where(eq(ddcVariants.id, v.id))
      } else {
        await tx
          .insert(ddcVariants)
          .values({
            productId,
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp ?? null,
            stock: v.stock,
            isActive: v.isActive,
          })
          .onConflictDoUpdate({
            target: ddcVariants.sku,
            set: {
              name: v.name,
              unit: v.unit,
              quantity: v.quantity,
              price: v.price,
              mrp: v.mrp ?? null,
              stock: v.stock,
              isActive: v.isActive,
            },
          })
      }
    }

    if (input.dealerIds !== undefined) {
      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'ddc'),
            eq(dealerItems.productId, productId),
          ),
        )
      if (input.dealerIds.length > 0) {
        const uniqueDealers = Array.from(new Set(input.dealerIds))
        await tx.insert(dealerItems).values(
          uniqueDealers.map((dealerId) => ({
            id: crypto.randomUUID(),
            dealerId,
            catalogType: 'ddc',
            productId,
          })),
        )
      }
    }

    return { success: true, productId }
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function toggleProductStatusQuery(
  input: ToggleProductStatusInput,
) {
  if (input.catalogType === 'liquor') {
    await db
      .update(liquorProducts)
      .set({ [input.field]: input.value })
      .where(eq(liquorProducts.id, input.id))
  } else if (input.catalogType === 'food') {
    await db
      .update(foodProducts)
      .set({ [input.field]: input.value })
      .where(eq(foodProducts.id, input.id))
  } else if (input.catalogType === 'grocery') {
    await db
      .update(groceryProducts)
      .set({ [input.field]: input.value })
      .where(eq(groceryProducts.id, input.id))
  } else if (input.catalogType === 'ddc') {
    await db
      .update(ddcProducts)
      .set({ [input.field]: input.value })
      .where(eq(ddcProducts.id, input.id))
  }
  return { success: true }
}

export async function upsertCategoryQuery(input: UpsertCategoryInput) {
  const slug = slugify(input.slug?.trim() || input.name)

  try {
    const table =
      input.catalogType === 'liquor'
        ? liquorCategories
        : input.catalogType === 'food'
          ? foodCategories
          : input.catalogType === 'grocery'
            ? groceryCategories
            : ddcCategories

    if (input.id) {
      await db
        .update(table)
        .set({
          name: input.name,
          slug,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          showOnLandingPage: input.showOnLandingPage ?? false,
        })
        .where(eq(table.id, input.id))
    } else {
      await db.insert(table).values({
        name: input.name,
        slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        showOnLandingPage: input.showOnLandingPage ?? false,
      })
    }
    invalidateCatalogCache()
    return { success: true }
  } catch (err: any) {
    if (
      err?.code === '23505' ||
      err?.message?.includes('unique constraint') ||
      err?.message?.includes('duplicate key')
    ) {
      throw new Error(
        `A category with the name "${input.name}" or slug "${slug}" already exists.`,
      )
    }
    throw err
  }
}

export async function upsertBrandQuery(input: UpsertBrandInput) {
  const slug = slugify(input.slug?.trim() || input.name)

  try {
    const table =
      input.catalogType === 'liquor'
        ? liquorBrands
        : input.catalogType === 'food'
          ? foodBrands
          : input.catalogType === 'grocery'
            ? groceryBrands
            : ddcBrands

    if (input.id) {
      const [updated] = await db
        .update(table)
        .set({
          name: input.name,
          slug,
          origin: input.origin ?? null,
          description: input.description ?? null,
          logoUrl: input.logoUrl ?? null,
          isActive: input.isActive,
        })
        .where(eq(table.id, input.id))
        .returning()
      invalidateCatalogCache()
      return { success: true, brand: updated }
    } else {
      const [inserted] = await db
        .insert(table)
        .values({
          name: input.name,
          slug,
          origin: input.origin ?? null,
          description: input.description ?? null,
          logoUrl: input.logoUrl ?? null,
          isActive: input.isActive,
        })
        .returning()
      invalidateCatalogCache()
      return { success: true, brand: inserted }
    }
  } catch (err: any) {
    if (
      err?.code === '23505' ||
      err?.message?.includes('unique constraint') ||
      err?.message?.includes('duplicate key')
    ) {
      throw new Error(
        `A brand with the name "${input.name}" or slug "${slug}" already exists.`,
      )
    }
    throw err
  }
}

export async function deleteItemQuery(
  input: DeleteItemInput,
  externalTx?: DbTx,
) {
  const run = async (tx: DbTx) => {
    if (input.catalogType === 'liquor') {
      const [prod] = await tx
        .select()
        .from(liquorProducts)
        .where(eq(liquorProducts.id, input.id))
        .limit(1)

      if (prod) {
        const [variants, images, dItems] = await Promise.all([
          tx
            .select()
            .from(liquorVariants)
            .where(eq(liquorVariants.productId, input.id)),
          tx
            .select()
            .from(liquorImages)
            .where(eq(liquorImages.productId, input.id)),
          tx
            .select()
            .from(dealerItems)
            .where(
              and(
                eq(dealerItems.catalogType, 'liquor'),
                eq(dealerItems.productId, input.id),
              ),
            ),
        ])

        await moveToRecycleBin(
          {
            entityType: 'liquor_product',
            entityId: prod.id,
            name: prod.name,
            description: prod.slug,
            data: { product: prod, variants, images, dealerItems: dItems },
          },
          tx,
        )
      }

      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'liquor'),
            eq(dealerItems.productId, input.id),
          ),
        )
      const variantRows = await tx
        .select({ id: liquorVariants.id })
        .from(liquorVariants)
        .where(eq(liquorVariants.productId, input.id))
      const variantIds = variantRows.map((v) => v.id)
      if (variantIds.length > 0) {
        await tx
          .delete(dealerStock)
          .where(
            and(
              eq(dealerStock.catalogType, 'liquor'),
              inArray(dealerStock.variantId, variantIds),
            ),
          )
      }
      await tx.delete(liquorProducts).where(eq(liquorProducts.id, input.id))
    } else if (input.catalogType === 'food') {
      const [prod] = await tx
        .select()
        .from(foodProducts)
        .where(eq(foodProducts.id, input.id))
        .limit(1)

      if (prod) {
        const [variants, images, dItems] = await Promise.all([
          tx
            .select()
            .from(foodVariants)
            .where(eq(foodVariants.productId, input.id)),
          tx
            .select()
            .from(foodImages)
            .where(eq(foodImages.productId, input.id)),
          tx
            .select()
            .from(dealerItems)
            .where(
              and(
                eq(dealerItems.catalogType, 'food'),
                eq(dealerItems.productId, input.id),
              ),
            ),
        ])

        await moveToRecycleBin(
          {
            entityType: 'food_product',
            entityId: prod.id,
            name: prod.name,
            description: prod.slug,
            data: { product: prod, variants, images, dealerItems: dItems },
          },
          tx,
        )
      }

      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'food'),
            eq(dealerItems.productId, input.id),
          ),
        )
      const variantRows = await tx
        .select({ id: foodVariants.id })
        .from(foodVariants)
        .where(eq(foodVariants.productId, input.id))
      const variantIds = variantRows.map((v) => v.id)
      if (variantIds.length > 0) {
        await tx
          .delete(dealerStock)
          .where(
            and(
              eq(dealerStock.catalogType, 'food'),
              inArray(dealerStock.variantId, variantIds),
            ),
          )
      }
      await tx.delete(foodProducts).where(eq(foodProducts.id, input.id))
    } else if (input.catalogType === 'grocery') {
      const [prod] = await tx
        .select()
        .from(groceryProducts)
        .where(eq(groceryProducts.id, input.id))
        .limit(1)

      if (prod) {
        const [variants, images, dItems] = await Promise.all([
          tx
            .select()
            .from(groceryVariants)
            .where(eq(groceryVariants.productId, input.id)),
          tx
            .select()
            .from(groceryImages)
            .where(eq(groceryImages.productId, input.id)),
          tx
            .select()
            .from(dealerItems)
            .where(
              and(
                eq(dealerItems.catalogType, 'grocery'),
                eq(dealerItems.productId, input.id),
              ),
            ),
        ])

        await moveToRecycleBin(
          {
            entityType: 'grocery_product',
            entityId: prod.id,
            name: prod.name,
            description: prod.slug,
            data: { product: prod, variants, images, dealerItems: dItems },
          },
          tx,
        )
      }

      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'grocery'),
            eq(dealerItems.productId, input.id),
          ),
        )
      const variantRows = await tx
        .select({ id: groceryVariants.id })
        .from(groceryVariants)
        .where(eq(groceryVariants.productId, input.id))
      const variantIds = variantRows.map((v) => v.id)
      if (variantIds.length > 0) {
        await tx
          .delete(dealerStock)
          .where(
            and(
              eq(dealerStock.catalogType, 'grocery'),
              inArray(dealerStock.variantId, variantIds),
            ),
          )
      }
      await tx.delete(groceryProducts).where(eq(groceryProducts.id, input.id))
    } else if (input.catalogType === 'ddc') {
      const [prod] = await tx
        .select()
        .from(ddcProducts)
        .where(eq(ddcProducts.id, input.id))
        .limit(1)

      if (prod) {
        const [variants, images, dItems] = await Promise.all([
          tx
            .select()
            .from(ddcVariants)
            .where(eq(ddcVariants.productId, input.id)),
          tx
            .select()
            .from(ddcImages)
            .where(eq(ddcImages.productId, input.id)),
          tx
            .select()
            .from(dealerItems)
            .where(
              and(
                eq(dealerItems.catalogType, 'ddc'),
                eq(dealerItems.productId, input.id),
              ),
            ),
        ])

        await moveToRecycleBin(
          {
            entityType: 'ddc_product',
            entityId: prod.id,
            name: prod.name,
            description: prod.slug,
            data: { product: prod, variants, images, dealerItems: dItems },
          },
          tx,
        )
      }

      await tx
        .delete(dealerItems)
        .where(
          and(
            eq(dealerItems.catalogType, 'ddc'),
            eq(dealerItems.productId, input.id),
          ),
        )
      const variantRows = await tx
        .select({ id: ddcVariants.id })
        .from(ddcVariants)
        .where(eq(ddcVariants.productId, input.id))
      const variantIds = variantRows.map((v) => v.id)
      if (variantIds.length > 0) {
        await tx
          .delete(dealerStock)
          .where(
            and(
              eq(dealerStock.catalogType, 'ddc'),
              inArray(dealerStock.variantId, variantIds),
            ),
          )
      }
      await tx.delete(ddcProducts).where(eq(ddcProducts.id, input.id))
    } else if (input.catalogType === 'liquor-category') {
      const [cat] = await tx
        .select()
        .from(liquorCategories)
        .where(eq(liquorCategories.id, input.id))
        .limit(1)

      if (cat) {
        await moveToRecycleBin(
          {
            entityType: 'liquor_category',
            entityId: cat.id,
            name: cat.name,
            description: cat.slug,
            data: { category: cat },
          },
          tx,
        )
      }

      const products = await tx
        .select({ id: liquorProducts.id })
        .from(liquorProducts)
        .where(eq(liquorProducts.categoryId, input.id))
      const productIds = products.map((p) => p.id)
      if (productIds.length > 0) {
        await tx
          .delete(dealerItems)
          .where(
            and(
              eq(dealerItems.catalogType, 'liquor'),
              inArray(dealerItems.productId, productIds),
            ),
          )
        const variantRows = await tx
          .select({ id: liquorVariants.id })
          .from(liquorVariants)
          .where(inArray(liquorVariants.productId, productIds))
        const variantIds = variantRows.map((v) => v.id)
        if (variantIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'liquor'),
                inArray(dealerStock.variantId, variantIds),
              ),
            )
        }
      }
      await tx.delete(liquorCategories).where(eq(liquorCategories.id, input.id))
    } else if (input.catalogType === 'food-category') {
      const [cat] = await tx
        .select()
        .from(foodCategories)
        .where(eq(foodCategories.id, input.id))
        .limit(1)

      if (cat) {
        await moveToRecycleBin(
          {
            entityType: 'food_category',
            entityId: cat.id,
            name: cat.name,
            description: cat.slug,
            data: { category: cat },
          },
          tx,
        )
      }

      const products = await tx
        .select({ id: foodProducts.id })
        .from(foodProducts)
        .where(eq(foodProducts.categoryId, input.id))
      const productIds = products.map((p) => p.id)
      if (productIds.length > 0) {
        await tx
          .delete(dealerItems)
          .where(
            and(
              eq(dealerItems.catalogType, 'food'),
              inArray(dealerItems.productId, productIds),
            ),
          )
        const variantRows = await tx
          .select({ id: foodVariants.id })
          .from(foodVariants)
          .where(inArray(foodVariants.productId, productIds))
        const variantIds = variantRows.map((v) => v.id)
        if (variantIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'food'),
                inArray(dealerStock.variantId, variantIds),
              ),
            )
        }
      }
      await tx
        .delete(foodCategories)
        .where(eq(foodCategories.id, input.id))
    } else if (input.catalogType === 'grocery-category') {
      const [cat] = await tx
        .select()
        .from(groceryCategories)
        .where(eq(groceryCategories.id, input.id))
        .limit(1)

      if (cat) {
        await moveToRecycleBin(
          {
            entityType: 'grocery_category',
            entityId: cat.id,
            name: cat.name,
            description: cat.slug,
            data: { category: cat },
          },
          tx,
        )
      }

      const products = await tx
        .select({ id: groceryProducts.id })
        .from(groceryProducts)
        .where(eq(groceryProducts.categoryId, input.id))
      const productIds = products.map((p) => p.id)
      if (productIds.length > 0) {
        await tx
          .delete(dealerItems)
          .where(
            and(
              eq(dealerItems.catalogType, 'grocery'),
              inArray(dealerItems.productId, productIds),
            ),
          )
        const variantRows = await tx
          .select({ id: groceryVariants.id })
          .from(groceryVariants)
          .where(inArray(groceryVariants.productId, productIds))
        const variantIds = variantRows.map((v) => v.id)
        if (variantIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'grocery'),
                inArray(dealerStock.variantId, variantIds),
              ),
            )
        }
      }
      await tx
        .delete(groceryCategories)
        .where(eq(groceryCategories.id, input.id))
    } else if (input.catalogType === 'ddc-category') {
      const [cat] = await tx
        .select()
        .from(ddcCategories)
        .where(eq(ddcCategories.id, input.id))
        .limit(1)

      if (cat) {
        await moveToRecycleBin(
          {
            entityType: 'ddc_category',
            entityId: cat.id,
            name: cat.name,
            description: cat.slug,
            data: { category: cat },
          },
          tx,
        )
      }

      const products = await tx
        .select({ id: ddcProducts.id })
        .from(ddcProducts)
        .where(eq(ddcProducts.categoryId, input.id))
      const productIds = products.map((p) => p.id)
      if (productIds.length > 0) {
        await tx
          .delete(dealerItems)
          .where(
            and(
              eq(dealerItems.catalogType, 'ddc'),
              inArray(dealerItems.productId, productIds),
            ),
          )
        const variantRows = await tx
          .select({ id: ddcVariants.id })
          .from(ddcVariants)
          .where(inArray(ddcVariants.productId, productIds))
        const variantIds = variantRows.map((v) => v.id)
        if (variantIds.length > 0) {
          await tx
            .delete(dealerStock)
            .where(
              and(
                eq(dealerStock.catalogType, 'ddc'),
                inArray(dealerStock.variantId, variantIds),
              ),
            )
        }
      }
      await tx
        .delete(ddcCategories)
        .where(eq(ddcCategories.id, input.id))
    } else if (input.catalogType === 'food-brand') {
      const [brand] = await tx
        .select()
        .from(foodBrands)
        .where(eq(foodBrands.id, input.id))
        .limit(1)

      if (brand) {
        await moveToRecycleBin(
          {
            entityType: 'food_brand',
            entityId: brand.id,
            name: brand.name,
            description: brand.slug,
            data: { brand },
          },
          tx,
        )
      }

      await tx.delete(foodBrands).where(eq(foodBrands.id, input.id))
    } else if (input.catalogType === 'grocery-brand') {
      const [brand] = await tx
        .select()
        .from(groceryBrands)
        .where(eq(groceryBrands.id, input.id))
        .limit(1)

      if (brand) {
        await moveToRecycleBin(
          {
            entityType: 'grocery_brand',
            entityId: brand.id,
            name: brand.name,
            description: brand.slug,
            data: { brand },
          },
          tx,
        )
      }

      await tx.delete(groceryBrands).where(eq(groceryBrands.id, input.id))
    } else if (input.catalogType === 'ddc-brand') {
      const [brand] = await tx
        .select()
        .from(ddcBrands)
        .where(eq(ddcBrands.id, input.id))
        .limit(1)

      if (brand) {
        await moveToRecycleBin(
          {
            entityType: 'ddc_brand',
            entityId: brand.id,
            name: brand.name,
            description: brand.slug,
            data: { brand },
          },
          tx,
        )
      }

      await tx.delete(ddcBrands).where(eq(ddcBrands.id, input.id))
    } else if (input.catalogType === 'liquor-brand') {
      const [brand] = await tx
        .select()
        .from(liquorBrands)
        .where(eq(liquorBrands.id, input.id))
        .limit(1)

      if (brand) {
        await moveToRecycleBin(
          {
            entityType: 'liquor_brand',
            entityId: brand.id,
            name: brand.name,
            description: brand.slug,
            data: { brand },
          },
          tx,
        )
      }

      await tx.delete(liquorBrands).where(eq(liquorBrands.id, input.id))
    } else {
      const [dealer] = await tx
        .select()
        .from(dealers)
        .where(eq(dealers.id, input.id))
        .limit(1)

      if (dealer) {
        const dItems = await tx
          .select()
          .from(dealerItems)
          .where(eq(dealerItems.dealerId, input.id))

        await moveToRecycleBin(
          {
            entityType: 'dealer',
            entityId: dealer.id,
            name: dealer.name,
            description: dealer.contact,
            data: { dealer, dealerItems: dItems },
          },
          tx,
        )
      }

      await tx.delete(dealerItems).where(eq(dealerItems.dealerId, input.id))
      await tx.delete(dealers).where(eq(dealers.id, input.id))
    }
    return { success: true }
  }

  const result = externalTx
    ? await run(externalTx)
    : await dbTx.transaction((tx) => run(tx))

  invalidateCatalogCache()
  return result
}

export async function toggleCategoryStatusQuery(
  input: ToggleCategoryStatusInput,
) {
  const table =
    input.catalogType === 'liquor'
      ? liquorCategories
      : input.catalogType === 'food'
        ? foodCategories
        : input.catalogType === 'grocery'
          ? groceryCategories
          : ddcCategories
  await db
    .update(table)
    .set({
      [input.field]: input.value,
      updatedAt: new Date(),
    })
    .where(eq(table.id, input.id))
  invalidateCatalogCache()
  return { success: true }
}

export async function getAdminUsersQuery() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
}

export async function updateUserRoleQuery(input: {
  userId: string
  role: string
  isActive?: boolean
}) {
  await db
    .update(user)
    .set({
      role: input.role,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(user.id, input.userId))
  return { success: true }
}

export async function getProductsByIdsQuery(ids: string[]) {
  if (ids.length === 0) return []

  const [liquorRows, foodRows, groceryRows, ddcRows] = await Promise.all([
    db
      .select({
        id: liquorProducts.id,
        name: liquorProducts.name,
        slug: liquorProducts.slug,
        description: liquorProducts.description,
        isFeatured: liquorProducts.isFeatured,
        customBadge: liquorProducts.customBadge,
        customDiscountLabel: liquorProducts.customDiscountLabel,
        categoryName: liquorCategories.name,
        categorySlug: liquorCategories.slug,
        brandName: liquorBrands.name,
        brandSlug: liquorBrands.slug,
      })
      .from(liquorProducts)
      .innerJoin(
        liquorCategories,
        eq(liquorProducts.categoryId, liquorCategories.id),
      )
      .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))
      .where(
        and(eq(liquorProducts.isActive, true), inArray(liquorProducts.id, ids)),
      ),

    db
      .select({
        id: foodProducts.id,
        name: foodProducts.name,
        slug: foodProducts.slug,
        description: foodProducts.description,
        isFeatured: foodProducts.isFeatured,
        customBadge: foodProducts.customBadge,
        customDiscountLabel: foodProducts.customDiscountLabel,
        categoryName: foodCategories.name,
        categorySlug: foodCategories.slug,
      })
      .from(foodProducts)
      .innerJoin(
        foodCategories,
        eq(foodProducts.categoryId, foodCategories.id),
      )
      .where(
        and(
          eq(foodProducts.isActive, true),
          inArray(foodProducts.id, ids),
        ),
      ),

    db
      .select({
        id: groceryProducts.id,
        name: groceryProducts.name,
        slug: groceryProducts.slug,
        description: groceryProducts.description,
        isFeatured: groceryProducts.isFeatured,
        customBadge: groceryProducts.customBadge,
        customDiscountLabel: groceryProducts.customDiscountLabel,
        categoryName: groceryCategories.name,
        categorySlug: groceryCategories.slug,
      })
      .from(groceryProducts)
      .innerJoin(
        groceryCategories,
        eq(groceryProducts.categoryId, groceryCategories.id),
      )
      .where(
        and(
          eq(groceryProducts.isActive, true),
          inArray(groceryProducts.id, ids),
        ),
      ),

    db
      .select({
        id: ddcProducts.id,
        name: ddcProducts.name,
        slug: ddcProducts.slug,
        description: ddcProducts.description,
        isFeatured: ddcProducts.isFeatured,
        customBadge: ddcProducts.customBadge,
        customDiscountLabel: ddcProducts.customDiscountLabel,
        categoryName: ddcCategories.name,
        categorySlug: ddcCategories.slug,
      })
      .from(ddcProducts)
      .innerJoin(
        ddcCategories,
        eq(ddcProducts.categoryId, ddcCategories.id),
      )
      .where(
        and(
          eq(ddcProducts.isActive, true),
          inArray(ddcProducts.id, ids),
        ),
      ),
  ])

  const liquorIds = liquorRows.map((p) => p.id)
  const foodIds = foodRows.map((p) => p.id)
  const groceryIds = groceryRows.map((p) => p.id)
  const ddcIds = ddcRows.map((p) => p.id)

  const [
    liqVariants,
    liqImages,
    foodVariantsRows,
    foodImagesRows,
    grocVariantsRows,
    grocImagesRows,
    ddcVariantsRows,
    ddcImagesRows,
  ] = await Promise.all([
    liquorIds.length > 0
      ? db
          .select()
          .from(liquorVariants)
          .where(
            and(
              eq(liquorVariants.isActive, true),
              inArray(liquorVariants.productId, liquorIds),
            ),
          )
      : [],
    liquorIds.length > 0
      ? db
          .select()
          .from(liquorImages)
          .where(inArray(liquorImages.productId, liquorIds))
      : [],
    foodIds.length > 0
      ? db
          .select()
          .from(foodVariants)
          .where(
            and(
              eq(foodVariants.isActive, true),
              inArray(foodVariants.productId, foodIds),
            ),
          )
      : [],
    foodIds.length > 0
      ? db
          .select()
          .from(foodImages)
          .where(inArray(foodImages.productId, foodIds))
      : [],
    groceryIds.length > 0
      ? db
          .select()
          .from(groceryVariants)
          .where(
            and(
              eq(groceryVariants.isActive, true),
              inArray(groceryVariants.productId, groceryIds),
            ),
          )
      : [],
    groceryIds.length > 0
      ? db
          .select()
          .from(groceryImages)
          .where(inArray(groceryImages.productId, groceryIds))
      : [],
    ddcIds.length > 0
      ? db
          .select()
          .from(ddcVariants)
          .where(
            and(
              eq(ddcVariants.isActive, true),
              inArray(ddcVariants.productId, ddcIds),
            ),
          )
      : [],
    ddcIds.length > 0
      ? db
          .select()
          .from(ddcImages)
          .where(inArray(ddcImages.productId, ddcIds))
      : [],
  ])

  const liquorVariantsMap = new Map<string, typeof liqVariants>()
  for (const v of liqVariants) {
    const list = liquorVariantsMap.get(v.productId) ?? []
    list.push(v)
    liquorVariantsMap.set(v.productId, list)
  }

  const liquorImagesMap = new Map<string, string>()
  for (const img of liqImages) {
    if (img.isPrimary || !liquorImagesMap.has(img.productId)) {
      liquorImagesMap.set(img.productId, img.url)
    }
  }

  const foodVariantsMap = new Map<string, typeof foodVariantsRows>()
  for (const v of foodVariantsRows) {
    const list = foodVariantsMap.get(v.productId) ?? []
    list.push(v)
    foodVariantsMap.set(v.productId, list)
  }

  const foodImagesMap = new Map<string, string>()
  for (const img of foodImagesRows) {
    if (img.isPrimary || !foodImagesMap.has(img.productId)) {
      foodImagesMap.set(img.productId, img.url)
    }
  }

  const grocVariantsMap = new Map<string, typeof grocVariantsRows>()
  for (const v of grocVariantsRows) {
    const list = grocVariantsMap.get(v.productId) ?? []
    list.push(v)
    grocVariantsMap.set(v.productId, list)
  }

  const grocImagesMap = new Map<string, string>()
  for (const img of grocImagesRows) {
    if (img.isPrimary || !grocImagesMap.has(img.productId)) {
      grocImagesMap.set(img.productId, img.url)
    }
  }

  const ddcVariantsMap = new Map<string, typeof ddcVariantsRows>()
  for (const v of ddcVariantsRows) {
    const list = ddcVariantsMap.get(v.productId) ?? []
    list.push(v)
    ddcVariantsMap.set(v.productId, list)
  }

  const ddcImagesMap = new Map<string, string>()
  for (const img of ddcImagesRows) {
    if (img.isPrimary || !ddcImagesMap.has(img.productId)) {
      ddcImagesMap.set(img.productId, img.url)
    }
  }

  const result = [
    ...liquorRows.map((p) => ({
      ...p,
      catalogType: 'liquor' as const,
      primaryImage: liquorImagesMap.get(p.id) ?? null,
      variants: (liquorVariantsMap.get(p.id) ?? []).sort(
        (a, b) => a.price - b.price,
      ),
    })),
    ...foodRows.map((p) => ({
      ...p,
      brandName: null,
      brandSlug: null,
      catalogType: 'food' as const,
      primaryImage: foodImagesMap.get(p.id) ?? null,
      variants: (foodVariantsMap.get(p.id) ?? []).sort(
        (a, b) => a.price - b.price,
      ),
    })),
    ...groceryRows.map((p) => ({
      ...p,
      brandName: null,
      brandSlug: null,
      catalogType: 'grocery' as const,
      primaryImage: grocImagesMap.get(p.id) ?? null,
      variants: (grocVariantsMap.get(p.id) ?? []).sort(
        (a, b) => a.price - b.price,
      ),
    })),
    ...ddcRows.map((p) => ({
      ...p,
      brandName: null,
      brandSlug: null,
      catalogType: 'ddc' as const,
      primaryImage: ddcImagesMap.get(p.id) ?? null,
      variants: (ddcVariantsMap.get(p.id) ?? []).sort(
        (a, b) => a.price - b.price,
      ),
    })),
  ]

  // Filter out any products that have no active variants
  return result.filter((p) => p.variants.length > 0)
}

export async function deleteProductImageQuery(
  catalogType: 'liquor' | 'food' | 'grocery' | 'ddc',
  imageId: string,
) {
  if (catalogType === 'liquor') {
    await db.delete(liquorImages).where(eq(liquorImages.id, imageId))
  } else if (catalogType === 'food') {
    await db.delete(foodImages).where(eq(foodImages.id, imageId))
  } else if (catalogType === 'grocery') {
    await db.delete(groceryImages).where(eq(groceryImages.id, imageId))
  } else if (catalogType === 'ddc') {
    await db.delete(ddcImages).where(eq(ddcImages.id, imageId))
  }
  return { success: true }
}
