import { db } from '#/db'
import {
  liquorCategories,
  liquorBrands,
  liquorProducts,
  liquorVariants,
  liquorImages,
  groceryCategories,
  groceryProducts,
  groceryVariants,
  groceryImages,
} from '#/db/schema'
import { and, eq, ilike, or, asc } from 'drizzle-orm'
import type { ListLiquorInput, ListGroceryInput } from './catalog.schemas'

export async function getLiquorCategoriesQuery() {
  return db
    .select()
    .from(liquorCategories)
    .where(eq(liquorCategories.isActive, true))
    .orderBy(asc(liquorCategories.sortOrder), asc(liquorCategories.name))
}

export async function getLiquorBrandsQuery() {
  return db
    .select()
    .from(liquorBrands)
    .where(eq(liquorBrands.isActive, true))
    .orderBy(asc(liquorBrands.name))
}

export async function getLiquorProductsQuery(input: ListLiquorInput) {
  const conditions = [eq(liquorProducts.isActive, true)]

  if (input.categorySlug) {
    const catRows = await db
      .select({ id: liquorCategories.id })
      .from(liquorCategories)
      .where(eq(liquorCategories.slug, input.categorySlug))
      .limit(1)
    if (catRows.length > 0) {
      conditions.push(eq(liquorProducts.categoryId, catRows[0].id))
    }
  }

  if (input.brandSlug) {
    const brRows = await db
      .select({ id: liquorBrands.id })
      .from(liquorBrands)
      .where(eq(liquorBrands.slug, input.brandSlug))
      .limit(1)
    if (brRows.length > 0) {
      conditions.push(eq(liquorProducts.brandId, brRows[0].id))
    }
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

  const variants = await db
    .select()
    .from(liquorVariants)
    .where(and(eq(liquorVariants.isActive, true)))

  const images = await db.select().from(liquorImages)

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    if (!productIds.includes(v.productId)) continue
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  for (const img of images) {
    if (!productIds.includes(img.productId)) continue
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

export async function getGroceryCategoriesQuery() {
  return db
    .select()
    .from(groceryCategories)
    .where(eq(groceryCategories.isActive, true))
    .orderBy(asc(groceryCategories.sortOrder), asc(groceryCategories.name))
}

export async function getGroceryProductsQuery(input: ListGroceryInput) {
  const conditions = [eq(groceryProducts.isActive, true)]

  if (input.categorySlug) {
    const catRows = await db
      .select({ id: groceryCategories.id })
      .from(groceryCategories)
      .where(eq(groceryCategories.slug, input.categorySlug))
      .limit(1)
    if (catRows.length > 0) {
      conditions.push(eq(groceryProducts.categoryId, catRows[0].id))
    }
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

  const variants = await db
    .select()
    .from(groceryVariants)
    .where(and(eq(groceryVariants.isActive, true)))

  const images = await db.select().from(groceryImages)

  const variantsMap = new Map<string, typeof variants>()
  for (const v of variants) {
    if (!productIds.includes(v.productId)) continue
    const current = variantsMap.get(v.productId) ?? []
    current.push(v)
    variantsMap.set(v.productId, current)
  }

  const imagesMap = new Map<string, string>()
  for (const img of images) {
    if (!productIds.includes(img.productId)) continue
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
