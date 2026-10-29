import { db } from '#/db'
import {
  recycleBin,
  liquorProducts,
  liquorVariants,
  liquorImages,
  liquorCategories,
  liquorBrands,
  groceryProducts,
  groceryVariants,
  groceryImages,
  groceryCategories,
  groceryBrands,
  dealers,
  dealerItems,
  coupons,
  banners,
  offers,
  riders,
} from '#/db/schema'
import { desc, eq, lte } from 'drizzle-orm'

export interface MoveToRecycleBinParams {
  entityType:
    | 'liquor_product'
    | 'grocery_product'
    | 'liquor_category'
    | 'grocery_category'
    | 'liquor_brand'
    | 'grocery_brand'
    | 'dealer'
    | 'coupon'
    | 'banner'
    | 'offer'
    | 'rider'
  entityId: string
  name: string
  description?: string | null
  data: Record<string, any>
  deletedBy?: string
}

export async function moveToRecycleBin(params: MoveToRecycleBinParams) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) // 15 days retention

  const id = crypto.randomUUID()
  await db.insert(recycleBin).values({
    id,
    entityType: params.entityType,
    entityId: params.entityId,
    name: params.name,
    description: params.description || null,
    data: params.data,
    deletedBy: params.deletedBy || 'Admin',
    deletedAt: now,
    expiresAt,
  })

  return { id, expiresAt }
}

export async function purgeExpiredRecycleBinItemsQuery() {
  const now = new Date()
  await db.delete(recycleBin).where(lte(recycleBin.expiresAt, now))
}

export async function getRecycleBinItemsQuery() {
  // Purge any expired items older than 15 days
  await purgeExpiredRecycleBinItemsQuery()

  const rows = await db
    .select()
    .from(recycleBin)
    .orderBy(desc(recycleBin.deletedAt))

  const now = Date.now()

  const items = rows.map((row) => {
    const expiresAtMs = new Date(row.expiresAt).getTime()
    const remainingMs = Math.max(0, expiresAtMs - now)
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60))

    let remainingLabel = ''
    let urgency: 'safe' | 'warning' | 'critical' | 'expired' = 'safe'

    if (remainingMs <= 0) {
      remainingLabel = 'Expired (Pending purge)'
      urgency = 'expired'
    } else if (remainingDays > 1) {
      remainingLabel = `${remainingDays} days left`
      urgency = remainingDays <= 3 ? 'critical' : remainingDays <= 7 ? 'warning' : 'safe'
    } else {
      remainingLabel = remainingHours > 1 ? `${remainingHours} hours left` : 'Less than an hour left'
      urgency = 'critical'
    }

    const rdata = (row.data ?? {}) as Record<string, any>

    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      name: row.name,
      description: row.description,
      deletedBy: row.deletedBy,
      deletedAt: row.deletedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      remainingDays,
      remainingLabel,
      urgency,
      preview: {
        category: rdata.category?.name || rdata.product?.categoryName,
        slug: rdata.product?.slug || rdata.category?.slug || rdata.brand?.slug || rdata.coupon?.code || rdata.offer?.slug,
        price: rdata.product?.variants?.[0]?.price || rdata.variants?.[0]?.price,
        image: rdata.images?.[0]?.url || rdata.product?.imageUrl || rdata.category?.imageUrl || rdata.banner?.imageUrl,
      },
    }
  })

  const expiringSoon = items.filter((i) => i.remainingDays <= 3).length

  return {
    items,
    stats: {
      total: items.length,
      expiringSoon,
      retentionDays: 15,
    },
  }
}

export async function restoreRecycleBinItemQuery(id: string) {
  const [row] = await db
    .select()
    .from(recycleBin)
    .where(eq(recycleBin.id, id))
    .limit(1)

  if (!row) {
    throw new Error('Item not found in Recycle Bin or already purged')
  }

  const data = row.data as Record<string, any>
  const entityType = row.entityType

  switch (entityType) {
    case 'liquor_product': {
      const { product, variants, images, dealerItems: dItems } = data
      if (!product) throw new Error('Invalid product data in Recycle Bin')

      // Check category exists
      let targetCategoryId = product.categoryId
      const catExists = await db
        .select({ id: liquorCategories.id })
        .from(liquorCategories)
        .where(eq(liquorCategories.id, targetCategoryId))
        .limit(1)

      if (catExists.length === 0) {
        const fallbackCat = await db
          .select({ id: liquorCategories.id })
          .from(liquorCategories)
          .limit(1)
        if (fallbackCat.length > 0) {
          targetCategoryId = fallbackCat[0].id
        }
      }

      // Check unique slug collision
      let targetSlug = product.slug
      const slugExists = await db
        .select({ id: liquorProducts.id })
        .from(liquorProducts)
        .where(eq(liquorProducts.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${product.slug}-restored-${Date.now().toString(36)}`
      }

      // Restore product
      await db.insert(liquorProducts).values({
        id: product.id,
        name: product.name,
        slug: targetSlug,
        categoryId: targetCategoryId,
        brandId: product.brandId || null,
        description: product.description || null,
        isFeatured: Boolean(product.isFeatured),
        customBadge: product.customBadge || null,
        customDiscountLabel: product.customDiscountLabel || null,
        isActive: Boolean(product.isActive),
        createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
        updatedAt: new Date(),
      })

      // Restore variants
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          let variantSku = v.sku
          const skuExists = await db
            .select({ id: liquorVariants.id })
            .from(liquorVariants)
            .where(eq(liquorVariants.sku, variantSku))
            .limit(1)
          if (skuExists.length > 0) {
            variantSku = `${v.sku}-restored`
          }

          await db.insert(liquorVariants).values({
            id: v.id,
            productId: product.id,
            name: v.name,
            volumeMl: v.volumeMl || 750,
            sku: variantSku,
            price: v.price || 0,
            mrp: v.mrp || null,
            compareAtPrice: v.compareAtPrice || null,
            abv: v.abv ? String(v.abv) : null,
            stock: v.stock || 0,
            isActive: Boolean(v.isActive),
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            updatedAt: new Date(),
          })
        }
      }

      // Restore images
      if (Array.isArray(images) && images.length > 0) {
        await db.insert(liquorImages).values(
          images.map((img: any) => ({
            id: img.id,
            productId: product.id,
            url: img.url,
            isPrimary: Boolean(img.isPrimary),
            sortOrder: img.sortOrder || 0,
            createdAt: img.createdAt ? new Date(img.createdAt) : new Date(),
          })),
        )
      }

      // Restore dealerItems links
      if (Array.isArray(dItems) && dItems.length > 0) {
        for (const di of dItems) {
          try {
            await db.insert(dealerItems).values({
              id: di.id || crypto.randomUUID(),
              dealerId: di.dealerId,
              catalogType: 'liquor',
              productId: product.id,
              costPrice: di.costPrice || 0,
              isAvailable: di.isAvailable !== false,
            })
          } catch {
            // ignore if dealer no longer exists
          }
        }
      }
      break
    }

    case 'grocery_product': {
      const { product, variants, images, dealerItems: dItems } = data
      if (!product) throw new Error('Invalid product data in Recycle Bin')

      // Check category exists
      let targetCategoryId = product.categoryId
      const catExists = await db
        .select({ id: groceryCategories.id })
        .from(groceryCategories)
        .where(eq(groceryCategories.id, targetCategoryId))
        .limit(1)

      if (catExists.length === 0) {
        const fallbackCat = await db
          .select({ id: groceryCategories.id })
          .from(groceryCategories)
          .limit(1)
        if (fallbackCat.length > 0) {
          targetCategoryId = fallbackCat[0].id
        }
      }

      // Check unique slug collision
      let targetSlug = product.slug
      const slugExists = await db
        .select({ id: groceryProducts.id })
        .from(groceryProducts)
        .where(eq(groceryProducts.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${product.slug}-restored-${Date.now().toString(36)}`
      }

      // Restore product
      await db.insert(groceryProducts).values({
        id: product.id,
        name: product.name,
        slug: targetSlug,
        categoryId: targetCategoryId,
        brandId: product.brandId || null,
        description: product.description || null,
        isFeatured: Boolean(product.isFeatured),
        customBadge: product.customBadge || null,
        customDiscountLabel: product.customDiscountLabel || null,
        isActive: Boolean(product.isActive),
        createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
        updatedAt: new Date(),
      })

      // Restore variants
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          let variantSku = v.sku
          const skuExists = await db
            .select({ id: groceryVariants.id })
            .from(groceryVariants)
            .where(eq(groceryVariants.sku, variantSku))
            .limit(1)
          if (skuExists.length > 0) {
            variantSku = `${v.sku}-restored`
          }

          await db.insert(groceryVariants).values({
            id: v.id,
            productId: product.id,
            name: v.name,
            quantity: String(v.quantity ?? 1),
            unit: v.unit || 'pack',
            sku: variantSku,
            price: v.price || 0,
            mrp: v.mrp || null,
            compareAtPrice: v.compareAtPrice || null,
            stock: v.stock || 0,
            isActive: Boolean(v.isActive),
            createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
            updatedAt: new Date(),
          })
        }
      }

      // Restore images
      if (Array.isArray(images) && images.length > 0) {
        await db.insert(groceryImages).values(
          images.map((img: any) => ({
            id: img.id,
            productId: product.id,
            url: img.url,
            isPrimary: Boolean(img.isPrimary),
            sortOrder: img.sortOrder || 0,
            createdAt: img.createdAt ? new Date(img.createdAt) : new Date(),
          })),
        )
      }

      // Restore dealerItems links
      if (Array.isArray(dItems) && dItems.length > 0) {
        for (const di of dItems) {
          try {
            await db.insert(dealerItems).values({
              id: di.id || crypto.randomUUID(),
              dealerId: di.dealerId,
              catalogType: 'grocery',
              productId: product.id,
              costPrice: di.costPrice || 0,
              isAvailable: di.isAvailable !== false,
            })
          } catch {
            // ignore if dealer no longer exists
          }
        }
      }
      break
    }

    case 'liquor_category': {
      const cat = data.category || data
      let targetSlug = cat.slug
      const slugExists = await db
        .select({ id: liquorCategories.id })
        .from(liquorCategories)
        .where(eq(liquorCategories.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${cat.slug}-restored`
      }

      await db.insert(liquorCategories).values({
        id: cat.id,
        name: cat.name,
        slug: targetSlug,
        description: cat.description || null,
        imageUrl: cat.imageUrl || null,
        sortOrder: cat.sortOrder ?? 0,
        isActive: Boolean(cat.isActive),
        showOnLandingPage: Boolean(cat.showOnLandingPage),
        createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      break
    }

    case 'grocery_category': {
      const cat = data.category || data
      let targetSlug = cat.slug
      const slugExists = await db
        .select({ id: groceryCategories.id })
        .from(groceryCategories)
        .where(eq(groceryCategories.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${cat.slug}-restored`
      }

      await db.insert(groceryCategories).values({
        id: cat.id,
        name: cat.name,
        slug: targetSlug,
        description: cat.description || null,
        imageUrl: cat.imageUrl || null,
        sortOrder: cat.sortOrder ?? 0,
        isActive: Boolean(cat.isActive),
        showOnLandingPage: Boolean(cat.showOnLandingPage),
        createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      break
    }

    case 'liquor_brand': {
      const brand = data.brand || data
      let targetSlug = brand.slug
      const slugExists = await db
        .select({ id: liquorBrands.id })
        .from(liquorBrands)
        .where(eq(liquorBrands.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${brand.slug}-restored`
      }

      await db.insert(liquorBrands).values({
        id: brand.id,
        name: brand.name,
        slug: targetSlug,
        origin: brand.origin || null,
        description: brand.description || null,
        logoUrl: brand.logoUrl || null,
        isActive: Boolean(brand.isActive),
        createdAt: brand.createdAt ? new Date(brand.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      break
    }

    case 'grocery_brand': {
      const brand = data.brand || data
      let targetSlug = brand.slug
      const slugExists = await db
        .select({ id: groceryBrands.id })
        .from(groceryBrands)
        .where(eq(groceryBrands.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${brand.slug}-restored`
      }

      await db.insert(groceryBrands).values({
        id: brand.id,
        name: brand.name,
        slug: targetSlug,
        origin: brand.origin || null,
        description: brand.description || null,
        logoUrl: brand.logoUrl || null,
        isActive: Boolean(brand.isActive),
        createdAt: brand.createdAt ? new Date(brand.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      break
    }

    case 'dealer': {
      const { dealer, dealerItems: dItems } = data
      if (!dealer) throw new Error('Invalid dealer data')

      await db.insert(dealers).values({
        id: dealer.id,
        name: dealer.name,
        contact: dealer.contact,
        whatsappNumber: dealer.whatsappNumber || null,
        pan: dealer.pan || null,
        vatNumber: dealer.vatNumber || null,
        providesVatBill: Boolean(dealer.providesVatBill),
        tdsRate: dealer.tdsRate ? String(dealer.tdsRate) : '0',
        creditLimit: dealer.creditLimit || 0,
        paymentTermsDays: dealer.paymentTermsDays || 0,
        openingBalance: dealer.openingBalance || 0,
        address: dealer.address || '',
        city: dealer.city || 'Butwal',
        lat: dealer.lat ? String(dealer.lat) : null,
        lng: dealer.lng ? String(dealer.lng) : null,
        isActive: Boolean(dealer.isActive),
        createdAt: dealer.createdAt ? new Date(dealer.createdAt) : new Date(),
        updatedAt: new Date(),
      })

      if (Array.isArray(dItems) && dItems.length > 0) {
        for (const di of dItems) {
          try {
            await db.insert(dealerItems).values({
              id: di.id || crypto.randomUUID(),
              dealerId: dealer.id,
              catalogType: di.catalogType,
              productId: di.productId,
              costPrice: di.costPrice || 0,
              isAvailable: di.isAvailable !== false,
            })
          } catch {
            // ignore
          }
        }
      }
      break
    }

    case 'coupon': {
      const coupon = data.coupon || data
      let targetCode = coupon.code
      const codeExists = await db
        .select({ id: coupons.id })
        .from(coupons)
        .where(eq(coupons.code, targetCode))
        .limit(1)

      if (codeExists.length > 0) {
        targetCode = `${coupon.code}-RESTORED`
      }

      await db.insert(coupons).values({
        id: coupon.id,
        code: targetCode,
        type: coupon.type,
        value: coupon.value,
        minOrder: coupon.minOrder || 0,
        usageLimit: coupon.usageLimit || 100,
        used: coupon.used || 0,
        perCustomerLimit: coupon.perCustomerLimit || 1,
        firstOrderOnly: Boolean(coupon.firstOrderOnly),
        active: Boolean(coupon.active),
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : new Date(Date.now() + 30 * 86400000),
        createdAt: coupon.createdAt ? new Date(coupon.createdAt) : new Date(),
      })
      break
    }

    case 'banner': {
      const banner = data.banner || data
      await db.insert(banners).values({
        id: banner.id,
        title: banner.title,
        imageUrl: banner.imageUrl,
        href: banner.href,
        placement: banner.placement || 'home',
        active: Boolean(banner.active),
        createdAt: banner.createdAt ? new Date(banner.createdAt) : new Date(),
      })
      break
    }

    case 'offer': {
      const offer = data.offer || data
      let targetSlug = offer.slug
      const slugExists = await db
        .select({ id: offers.id })
        .from(offers)
        .where(eq(offers.slug, targetSlug))
        .limit(1)

      if (slugExists.length > 0) {
        targetSlug = `${offer.slug}-restored`
      }

      await db.insert(offers).values({
        id: offer.id,
        title: offer.title || offer.name || 'Special Offer',
        slug: targetSlug,
        type: offer.type || 'percent',
        scope: offer.scope || 'all',
        scopeId: offer.scopeId || null,
        discountValue: offer.discountValue || 0,
        minOrderAmount: offer.minOrderAmount || 0,
        bannerUrl: offer.bannerUrl || null,
        heading: offer.heading || null,
        description: offer.description || null,
        priority: offer.priority || 0,
        stackable: Boolean(offer.stackable),
        active: Boolean(offer.active),
        startsAt: offer.startsAt ? new Date(offer.startsAt) : null,
        expiresAt: offer.expiresAt ? new Date(offer.expiresAt) : null,
        createdAt: offer.createdAt ? new Date(offer.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      break
    }

    case 'rider': {
      const rider = data.rider || data
      await db.insert(riders).values({
        id: rider.id,
        userId: rider.userId || null,
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        vehicle: rider.vehicle || 'bike',
        licenseNo: rider.licenseNo || '',
        verified: Boolean(rider.verified),
        available: Boolean(rider.available),
        status: rider.status || 'offline',
        lat: rider.lat ? String(rider.lat) : '27.7006',
        lng: rider.lng ? String(rider.lng) : '83.4484',
        zone: rider.zone || 'Butwal Core',
        baseSalary: rider.baseSalary || 0,
        perDropRate: rider.perDropRate || 5000,
        commissionRate: rider.commissionRate || 10,
        cashOnHand: rider.cashOnHand || 0,
        earnings: rider.earnings || 0,
        deliveries: rider.deliveries || 0,
        rating: rider.rating ? String(rider.rating) : '5.00',
        createdAt: rider.createdAt ? new Date(rider.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      break
    }

    default:
      throw new Error(`Unsupported entity type: ${entityType}`)
  }

  // Once restored successfully, delete from recycle bin
  await db.delete(recycleBin).where(eq(recycleBin.id, id))

  return { success: true, name: row.name, entityType }
}

export async function permanentDeleteRecycleBinItemQuery(id: string) {
  await db.delete(recycleBin).where(eq(recycleBin.id, id))
  return { success: true, id }
}

export async function emptyRecycleBinQuery() {
  await db.delete(recycleBin)
  return { success: true }
}
