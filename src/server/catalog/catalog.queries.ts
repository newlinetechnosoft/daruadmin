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
  user,
} from '#/db/schema'
import { and, eq, ilike, or, asc, desc, count } from 'drizzle-orm'
import type {
  ListLiquorInput,
  ListGroceryInput,
  UpsertLiquorProductInput,
  UpsertGroceryProductInput,
  ToggleProductStatusInput,
  UpsertCategoryInput,
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

export async function getLiquorCategoriesQuery() {
  return db
    .select()
    .from(liquorCategories)
    .where(eq(liquorCategories.isActive, true))
    .orderBy(asc(liquorCategories.sortOrder), asc(liquorCategories.name))
}

export async function getAllLiquorCategoriesQuery() {
  return db
    .select()
    .from(liquorCategories)
    .orderBy(asc(liquorCategories.sortOrder), asc(liquorCategories.name))
}

export async function getLiquorBrandsQuery() {
  return db
    .select()
    .from(liquorBrands)
    .where(eq(liquorBrands.isActive, true))
    .orderBy(asc(liquorBrands.name))
}

export async function getAllLiquorBrandsQuery() {
  return db.select().from(liquorBrands).orderBy(asc(liquorBrands.name))
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

export async function getAllGroceryCategoriesQuery() {
  return db
    .select()
    .from(groceryCategories)
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

// -------------------------------------------------------------
// ADMIN QUERIES
// -------------------------------------------------------------

export async function getAdminStatsQuery() {
  const [
    liquorRes,
    groceryRes,
    brandRes,
    liquorCatRes,
    groceryCatRes,
    userRes,
    allLiquorVariants,
    allGroceryVariants,
  ] = await Promise.all([
    db.select({ total: count() }).from(liquorProducts),
    db.select({ total: count() }).from(groceryProducts),
    db.select({ total: count() }).from(liquorBrands),
    db.select({ total: count() }).from(liquorCategories),
    db.select({ total: count() }).from(groceryCategories),
    db.select({ total: count() }).from(user),
    db.select().from(liquorVariants),
    db.select().from(groceryVariants),
  ])

  const totalStockLiquor = allLiquorVariants.reduce(
    (acc, v) => acc + v.stock,
    0,
  )
  const totalStockGrocery = allGroceryVariants.reduce(
    (acc, v) => acc + v.stock,
    0,
  )
  const lowStockCount =
    allLiquorVariants.filter((v) => v.stock <= 20).length +
    allGroceryVariants.filter((v) => v.stock <= 20).length

  return {
    totalLiquorProducts: liquorRes[0]?.total ?? 0,
    totalGroceryProducts: groceryRes[0]?.total ?? 0,
    totalBrands: brandRes[0]?.total ?? 0,
    totalCategories:
      (liquorCatRes[0]?.total ?? 0) + (groceryCatRes[0]?.total ?? 0),
    totalUsers: userRes[0]?.total ?? 0,
    totalStockUnits: totalStockLiquor + totalStockGrocery,
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
  const variants = await db.select().from(liquorVariants)
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

export async function getAdminGroceryProductsQuery() {
  const productsList = await db
    .select({
      id: groceryProducts.id,
      name: groceryProducts.name,
      slug: groceryProducts.slug,
      description: groceryProducts.description,
      isFeatured: groceryProducts.isFeatured,
      isActive: groceryProducts.isActive,
      categoryId: groceryProducts.categoryId,
      createdAt: groceryProducts.createdAt,
      categoryName: groceryCategories.name,
      categorySlug: groceryCategories.slug,
    })
    .from(groceryProducts)
    .innerJoin(
      groceryCategories,
      eq(groceryProducts.categoryId, groceryCategories.id),
    )
    .orderBy(desc(groceryProducts.createdAt))

  if (productsList.length === 0) return []

  const productIds = productsList.map((p) => p.id)
  const variants = await db.select().from(groceryVariants)
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

export async function upsertLiquorProductQuery(
  input: UpsertLiquorProductInput,
) {
  const slug = input.slug?.trim() || slugify(input.name)

  let productId = input.id

  if (productId) {
    await db
      .update(liquorProducts)
      .set({
        name: input.name,
        slug,
        categoryId: input.categoryId,
        brandId: input.brandId ?? null,
        description: input.description ?? null,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      })
      .where(eq(liquorProducts.id, productId))
  } else {
    const [inserted] = await db
      .insert(liquorProducts)
      .values({
        name: input.name,
        slug,
        categoryId: input.categoryId,
        brandId: input.brandId ?? null,
        description: input.description ?? null,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      })
      .returning({ id: liquorProducts.id })
    productId = inserted.id
  }

  if (input.imageUrl) {
    const existingImg = await db
      .select({ id: liquorImages.id })
      .from(liquorImages)
      .where(eq(liquorImages.productId, productId))
      .limit(1)

    if (existingImg.length > 0) {
      await db
        .update(liquorImages)
        .set({ url: input.imageUrl, alt: input.name, isPrimary: true })
        .where(eq(liquorImages.id, existingImg[0].id))
    } else {
      await db.insert(liquorImages).values({
        productId,
        url: input.imageUrl,
        alt: input.name,
        isPrimary: true,
      })
    }
  }

  for (const v of input.variants) {
    if (v.id) {
      await db
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
      await db
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

  return { success: true, productId }
}

export async function upsertGroceryProductQuery(
  input: UpsertGroceryProductInput,
) {
  const slug = input.slug?.trim() || slugify(input.name)

  let productId = input.id

  if (productId) {
    await db
      .update(groceryProducts)
      .set({
        name: input.name,
        slug,
        categoryId: input.categoryId,
        description: input.description ?? null,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      })
      .where(eq(groceryProducts.id, productId))
  } else {
    const [inserted] = await db
      .insert(groceryProducts)
      .values({
        name: input.name,
        slug,
        categoryId: input.categoryId,
        description: input.description ?? null,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      })
      .returning({ id: groceryProducts.id })
    productId = inserted.id
  }

  if (input.imageUrl) {
    const existingImg = await db
      .select({ id: groceryImages.id })
      .from(groceryImages)
      .where(eq(groceryImages.productId, productId))
      .limit(1)

    if (existingImg.length > 0) {
      await db
        .update(groceryImages)
        .set({ url: input.imageUrl, alt: input.name, isPrimary: true })
        .where(eq(groceryImages.id, existingImg[0].id))
    } else {
      await db.insert(groceryImages).values({
        productId,
        url: input.imageUrl,
        alt: input.name,
        isPrimary: true,
      })
    }
  }

  for (const v of input.variants) {
    if (v.id) {
      await db
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
      await db
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

  return { success: true, productId }
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
      .update(groceryProducts)
      .set({ [input.field]: input.value })
      .where(eq(groceryProducts.id, input.id))
  }
  return { success: true }
}

export async function upsertCategoryQuery(input: UpsertCategoryInput) {
  const slug = input.slug?.trim() || slugify(input.name)

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
      })
    }
  } else {
    if (input.id) {
      await db
        .update(groceryCategories)
        .set({
          name: input.name,
          slug,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        })
        .where(eq(groceryCategories.id, input.id))
    } else {
      await db.insert(groceryCategories).values({
        name: input.name,
        slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })
    }
  }

  return { success: true }
}

export async function upsertBrandQuery(input: UpsertBrandInput) {
  const slug = input.slug?.trim() || slugify(input.name)

  if (input.id) {
    await db
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
  } else {
    await db.insert(liquorBrands).values({
      name: input.name,
      slug,
      origin: input.origin ?? null,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      isActive: input.isActive,
    })
  }

  return { success: true }
}

export async function deleteItemQuery(input: DeleteItemInput) {
  if (input.catalogType === 'liquor') {
    await db.delete(liquorProducts).where(eq(liquorProducts.id, input.id))
  } else if (input.catalogType === 'grocery') {
    await db.delete(groceryProducts).where(eq(groceryProducts.id, input.id))
  } else if (input.catalogType === 'liquor-category') {
    await db.delete(liquorCategories).where(eq(liquorCategories.id, input.id))
  } else if (input.catalogType === 'grocery-category') {
    await db.delete(groceryCategories).where(eq(groceryCategories.id, input.id))
  } else {
    await db.delete(liquorBrands).where(eq(liquorBrands.id, input.id))
  }
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
