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
  UpsertLiquorProductInput,
  UpsertFoodProductInput,
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

export async function toggleProductStatusQuery(
  input: ToggleProductStatusInput,
) {
  if (input.catalogType === 'liquor') {
    await db
      .update(liquorProducts)
      .set({ [input.field]: input.value })
      .where(eq(liquorProducts.id, input.id))
  } else {
    await db
      .update(foodProducts)
      .set({ [input.field]: input.value })
      .where(eq(foodProducts.id, input.id))
  }
  return { success: true }
}

export async function upsertCategoryQuery(input: UpsertCategoryInput) {
  const slug = slugify(input.slug?.trim() || input.name)

  try {
    if (input.catalogType === 'liquor') {
      if (input.id) {
        await db
          .update(liquorCategories)
          .set({
            name: input.name,
            slug,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            sortOrder: input.sortOrder,
            isActive: input.isActive,
            showOnLandingPage: input.showOnLandingPage ?? false,
          })
          .where(eq(liquorCategories.id, input.id))
      } else {
        await db.insert(liquorCategories).values({
          name: input.name,
          slug,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          showOnLandingPage: input.showOnLandingPage ?? false,
        })
      }
    } else {
      if (input.id) {
        await db
          .update(foodCategories)
          .set({
            name: input.name,
            slug,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            sortOrder: input.sortOrder,
            isActive: input.isActive,
            showOnLandingPage: input.showOnLandingPage ?? false,
          })
          .where(eq(foodCategories.id, input.id))
      } else {
        await db.insert(foodCategories).values({
          name: input.name,
          slug,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          showOnLandingPage: input.showOnLandingPage ?? false,
        })
      }
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
    if (input.catalogType === 'food') {
      if (input.id) {
        const [updated] = await db
          .update(foodBrands)
          .set({
            name: input.name,
            slug,
            origin: input.origin ?? null,
            description: input.description ?? null,
            logoUrl: input.logoUrl ?? null,
            isActive: input.isActive,
          })
          .where(eq(foodBrands.id, input.id))
          .returning()
        invalidateCatalogCache()
        return { success: true, brand: updated }
      } else {
        const [inserted] = await db
          .insert(foodBrands)
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
    } else {
      if (input.id) {
        const [updated] = await db
          .update(liquorBrands)
          .set({
            name: input.name,
            slug,
            origin: input.origin ?? null,
            description: input.description ?? null,
            logoUrl: input.logoUrl ?? null,
            isActive: input.isActive,
          })
          .where(eq(liquorBrands.id, input.id))
          .returning()
        invalidateCatalogCache()
        return { success: true, brand: updated }
      } else {
        const [inserted] = await db
          .insert(liquorBrands)
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
    input.catalogType === 'liquor' ? liquorCategories : foodCategories
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

  const [liquorRows, foodRows] = await Promise.all([
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
  ])

  const liquorIds = liquorRows.map((p) => p.id)
  const foodIds = foodRows.map((p) => p.id)

  const [liqVariants, liqImages, foodVariantsRows, foodImagesRows] = await Promise.all([
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
  ]

  // Filter out any products that have no active variants
  return result.filter((p) => p.variants.length > 0)
}

export async function deleteProductImageQuery(
  catalogType: 'liquor' | 'food',
  imageId: string,
) {
  if (catalogType === 'liquor') {
    await db.delete(liquorImages).where(eq(liquorImages.id, imageId))
  } else {
    await db.delete(foodImages).where(eq(foodImages.id, imageId))
  }
  return { success: true }
}
