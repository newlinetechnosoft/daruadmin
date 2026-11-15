import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db, dbTx } from '#/db'
import {
  user,
  dealers,
  riders,
  liquorCategories,
  liquorBrands,
  liquorProducts,
  liquorVariants,
  groceryCategories,
  groceryBrands,
  groceryProducts,
  groceryVariants,
  foodProducts,
  ddcProducts,
  siteSettings,
  auditLogs,
} from '#/db/schema'
import { eq, or, desc, sql, count } from 'drizzle-orm'
import { getSessionUser, logAudit, isSuperAdmin } from '#/server/auth/permissions'
import { generateCsvString } from '#/lib/csv-helper'

function nid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parsePaisa(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''))
  if (isNaN(num)) return fallback
  return Math.round(num * 100)
}

function parseBool(val: unknown, fallback = true): boolean {
  if (val === null || val === undefined || val === '') return fallback
  const str = String(val).toLowerCase().trim()
  return str === 'true' || str === '1' || str === 'yes' || str === 'active'
}

function parseNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''))
  return isNaN(num) ? fallback : num
}

export const getSuperAdminBulkOverviewFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const [
      customerCountRes,
      dealerCountRes,
      riderCountRes,
      liquorProdRes,
      groceryProdRes,
      foodProdRes,
      ddcProdRes,
      liquorVarRes,
      groceryVarRes,
    ] = await Promise.all([
      db.select({ count: count() }).from(user).where(eq(user.role, 'customer')),
      db.select({ count: count() }).from(dealers),
      db.select({ count: count() }).from(riders),
      db.select({ count: count() }).from(liquorProducts),
      db.select({ count: count() }).from(groceryProducts),
      db.select({ count: count() }).from(foodProducts),
      db.select({ count: count() }).from(ddcProducts),
      db.select({ count: count() }).from(liquorVariants),
      db.select({ count: count() }).from(groceryVariants),
    ])

    const totalCustomers = customerCountRes[0]?.count ?? 0
    const totalDealers = dealerCountRes[0]?.count ?? 0
    const totalRiders = riderCountRes[0]?.count ?? 0
    const totalProducts =
      (liquorProdRes[0]?.count ?? 0) +
      (groceryProdRes[0]?.count ?? 0) +
      (foodProdRes[0]?.count ?? 0) +
      (ddcProdRes[0]?.count ?? 0)
    const totalVariants = (liquorVarRes[0]?.count ?? 0) + (groceryVarRes[0]?.count ?? 0)

    return {
      totalCustomers,
      totalDealers,
      totalRiders,
      totalProducts,
      totalVariants,
    }
  },
)

export const exportSuperAdminDataFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        entity: z.enum(['customers', 'items', 'dealers', 'riders', 'categories', 'brands']),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const todayStr = new Date().toISOString().slice(0, 10)

    if (data.entity === 'customers') {
      const rows = await db
        .select({
          name: user.name,
          email: user.email,
          phone: user.phone,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.role, 'customer'))
        .orderBy(desc(user.createdAt))

      const csv = generateCsvString(
        [
          { header: 'name', key: 'name' },
          { header: 'email', key: 'email' },
          { header: 'phone', key: 'phone' },
          { header: 'isActive', key: 'isActive' },
          { header: 'emailVerified', key: 'emailVerified' },
          { header: 'phoneVerified', key: 'phoneVerified' },
          {
            header: 'createdAt',
            value: (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : ''),
          },
        ],
        rows,
      )

      return {
        filename: `customers-export-${todayStr}.csv`,
        csv,
        count: rows.length,
      }
    }

    if (data.entity === 'dealers') {
      const rows = await db
        .select()
        .from(dealers)
        .orderBy(desc(dealers.createdAt))

      const csv = generateCsvString(
        [
          { header: 'name', key: 'name' },
          { header: 'contact', key: 'contact' },
          { header: 'phone', key: 'contact' },
          { header: 'whatsappNumber', key: 'whatsappNumber' },
          { header: 'pan', key: 'pan' },
          { header: 'vatNumber', key: 'vatNumber' },
          { header: 'providesVatBill', key: 'providesVatBill' },
          { header: 'creditLimitNPR', value: (r) => ((r.creditLimit ?? 0) / 100).toFixed(2) },
          { header: 'paymentTermsDays', key: 'paymentTermsDays' },
          { header: 'openingBalanceNPR', value: (r) => ((r.openingBalance ?? 0) / 100).toFixed(2) },
          { header: 'address', key: 'address' },
          { header: 'city', key: 'city' },
          { header: 'isActive', key: 'isActive' },
        ],
        rows,
      )

      return {
        filename: `dealers-export-${todayStr}.csv`,
        csv,
        count: rows.length,
      }
    }

    if (data.entity === 'riders') {
      const rows = await db
        .select()
        .from(riders)
        .orderBy(desc(riders.createdAt))

      const csv = generateCsvString(
        [
          { header: 'name', key: 'name' },
          { header: 'email', key: 'email' },
          { header: 'phone', key: 'phone' },
          { header: 'vehicle', key: 'vehicle' },
          { header: 'licenseNo', key: 'licenseNo' },
          { header: 'zone', key: 'zone' },
          { header: 'commissionRatePercent', key: 'commissionRate' },
          { header: 'baseSalaryNPR', value: (r) => ((r.baseSalary ?? 0) / 100).toFixed(2) },
          { header: 'status', key: 'status' },
          { header: 'verified', key: 'verified' },
          { header: 'available', key: 'available' },
        ],
        rows,
      )

      return {
        filename: `riders-export-${todayStr}.csv`,
        csv,
        count: rows.length,
      }
    }

    if (data.entity === 'items') {
      const [liquorRows, groceryRows] = await Promise.all([
        db
          .select({
            catalogType: sql<string>`'liquor'`,
            name: liquorProducts.name,
            slug: liquorProducts.slug,
            description: liquorProducts.description,
            isFeatured: liquorProducts.isFeatured,
            isActive: liquorProducts.isActive,
            categoryName: liquorCategories.name,
            categorySlug: liquorCategories.slug,
            brandName: liquorBrands.name,
            brandSlug: liquorBrands.slug,
            variantName: liquorVariants.name,
            volumeMl: liquorVariants.volumeMl,
            sku: liquorVariants.sku,
            price: liquorVariants.price,
            mrp: liquorVariants.mrp,
            stock: liquorVariants.stock,
            abv: liquorVariants.abv,
          })
          .from(liquorProducts)
          .leftJoin(liquorCategories, eq(liquorProducts.categoryId, liquorCategories.id))
          .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))
          .leftJoin(liquorVariants, eq(liquorProducts.id, liquorVariants.productId)),
        db
          .select({
            catalogType: sql<string>`'grocery'`,
            name: groceryProducts.name,
            slug: groceryProducts.slug,
            description: groceryProducts.description,
            isFeatured: groceryProducts.isFeatured,
            isActive: groceryProducts.isActive,
            categoryName: groceryCategories.name,
            categorySlug: groceryCategories.slug,
            brandName: groceryBrands.name,
            brandSlug: groceryBrands.slug,
            variantName: groceryVariants.name,
            volumeMl: sql<number>`0`,
            sku: groceryVariants.sku,
            price: groceryVariants.price,
            mrp: groceryVariants.mrp,
            stock: groceryVariants.stock,
            abv: sql<string | null>`null`,
          })
          .from(groceryProducts)
          .leftJoin(groceryCategories, eq(groceryProducts.categoryId, groceryCategories.id))
          .leftJoin(groceryBrands, eq(groceryProducts.brandId, groceryBrands.id))
          .leftJoin(groceryVariants, eq(groceryProducts.id, groceryVariants.productId)),
      ])

      const allItems = [...liquorRows, ...groceryRows]

      const csv = generateCsvString(
        [
          { header: 'catalogType', key: 'catalogType' },
          { header: 'name', key: 'name' },
          { header: 'slug', key: 'slug' },
          { header: 'categorySlug', key: 'categorySlug' },
          { header: 'brandSlug', key: 'brandSlug' },
          { header: 'variantName', key: 'variantName' },
          { header: 'volumeMl', key: 'volumeMl' },
          { header: 'abv', value: (r) => (r.abv ? String(r.abv) : '') },
          { header: 'sku', key: 'sku' },
          { header: 'priceNPR', value: (r) => ((r.price ?? 0) / 100).toFixed(2) },
          { header: 'mrpNPR', value: (r) => ((r.mrp ?? 0) / 100).toFixed(2) },
          { header: 'stock', key: 'stock' },
          { header: 'description', key: 'description' },
          { header: 'isFeatured', key: 'isFeatured' },
          { header: 'isActive', key: 'isActive' },
        ],
        allItems,
      )

      return {
        filename: `catalog-items-export-${todayStr}.csv`,
        csv,
        count: allItems.length,
      }
    }

    if (data.entity === 'categories') {
      const [lCats, gCats] = await Promise.all([
        db.select().from(liquorCategories),
        db.select().from(groceryCategories),
      ])

      const cats = [
        ...lCats.map((c) => ({ ...c, catalogType: 'liquor' })),
        ...gCats.map((c) => ({ ...c, catalogType: 'grocery' })),
      ]

      const csv = generateCsvString(
        [
          { header: 'catalogType', key: 'catalogType' },
          { header: 'name', key: 'name' },
          { header: 'slug', key: 'slug' },
          { header: 'description', key: 'description' },
          { header: 'isActive', key: 'isActive' },
        ],
        cats,
      )

      return {
        filename: `categories-export-${todayStr}.csv`,
        csv,
        count: cats.length,
      }
    }

    // Brands
    const [lBrands, gBrands] = await Promise.all([
      db.select().from(liquorBrands),
      db.select().from(groceryBrands),
    ])

    const brands = [
      ...lBrands.map((b) => ({ ...b, catalogType: 'liquor' })),
      ...gBrands.map((b) => ({ ...b, catalogType: 'grocery' })),
    ]

    const csv = generateCsvString(
      [
        { header: 'catalogType', key: 'catalogType' },
        { header: 'name', key: 'name' },
        { header: 'slug', key: 'slug' },
        { header: 'origin', key: 'origin' },
        { header: 'description', key: 'description' },
        { header: 'isActive', key: 'isActive' },
      ],
      brands,
    )

    return {
      filename: `brands-export-${todayStr}.csv`,
      csv,
      count: brands.length,
    }
  })

export const bulkImportSuperAdminDataFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        entity: z.enum(['customers', 'items', 'dealers', 'riders', 'categories', 'brands']),
        mode: z.enum(['upsert', 'skip']).default('upsert'),
        rows: z.array(z.record(z.string(), z.string())),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const { entity, mode, rows } = data
    if (rows.length === 0) {
      return { success: true, total: 0, inserted: 0, updated: 0, skipped: 0, errors: [] }
    }

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    await dbTx.transaction(async (tx) => {
      // 1. CUSTOMERS
      if (entity === 'customers') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const email = (r.email || '').trim().toLowerCase()
          const name = (r.name || '').trim()
          const phone = (r.phone || '').trim() || null

          if (!email || !name) {
            errors.push(`Row ${i + 2}: Missing required name or email`)
            continue
          }

          const existing = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, email))
            .limit(1)

          if (existing.length > 0) {
            if (mode === 'skip') {
              skipped++
              continue
            }
            await tx
              .update(user)
              .set({
                name,
                phone: phone || undefined,
                isActive: parseBool(r.isActive, true),
                emailVerified: parseBool(r.emailVerified, false),
                phoneVerified: parseBool(r.phoneVerified, false),
              })
              .where(eq(user.email, email))
            updated++
          } else {
            const userId = nid('usr')
            await tx.insert(user).values({
              id: userId,
              name,
              email,
              phone,
              role: 'customer',
              isActive: parseBool(r.isActive, true),
              emailVerified: parseBool(r.emailVerified, false),
              phoneVerified: parseBool(r.phoneVerified, false),
            })
            inserted++
          }
        }
      }

      // 2. DEALERS ("diller")
      else if (entity === 'dealers') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const name = (r.name || '').trim()
          const contact = (r.contact || r.phone || '').trim()
          const pan = (r.pan || '').trim() || null
          const address = (r.address || 'Butwal').trim()
          const city = (r.city || 'Butwal').trim()

          if (!name || !contact) {
            errors.push(`Row ${i + 2}: Missing required dealer name or contact phone`)
            continue
          }

          const existing = await tx
            .select({ id: dealers.id })
            .from(dealers)
            .where(or(eq(dealers.name, name), eq(dealers.contact, contact)))
            .limit(1)

          const creditLimit = parsePaisa(r.creditLimitNPR || r.creditLimit, 0)
          const openingBalance = parsePaisa(r.openingBalanceNPR || r.openingBalance, 0)
          const paymentTermsDays = Math.round(parseNum(r.paymentTermsDays, 0))

          if (existing.length > 0) {
            if (mode === 'skip') {
              skipped++
              continue
            }
            await tx
              .update(dealers)
              .set({
                name,
                contact,
                whatsappNumber: (r.whatsappNumber || contact).trim(),
                pan,
                vatNumber: (r.vatNumber || pan || '').trim() || null,
                providesVatBill: parseBool(r.providesVatBill, false),
                creditLimit,
                paymentTermsDays,
                address,
                city,
                isActive: parseBool(r.isActive, true),
              })
              .where(eq(dealers.id, existing[0].id))
            updated++
          } else {
            const dealerId = nid('dlr')
            await tx.insert(dealers).values({
              id: dealerId,
              name,
              contact,
              whatsappNumber: (r.whatsappNumber || contact).trim(),
              pan,
              vatNumber: (r.vatNumber || pan || '').trim() || null,
              providesVatBill: parseBool(r.providesVatBill, false),
              creditLimit,
              openingBalance,
              paymentTermsDays,
              address,
              city,
              isActive: parseBool(r.isActive, true),
            })
            inserted++
          }
        }
      }

      // 3. RIDERS
      else if (entity === 'riders') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const name = (r.name || '').trim()
          const email = (r.email || '').trim().toLowerCase()
          const phone = (r.phone || '').trim()

          if (!name || !email || !phone) {
            errors.push(`Row ${i + 2}: Rider requires name, email, and phone`)
            continue
          }

          // Ensure user account exists
          let assignedUserId: string
          const existingUser = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, email))
            .limit(1)

          if (existingUser.length > 0) {
            assignedUserId = existingUser[0].id
            await tx.update(user).set({ role: 'rider', phone }).where(eq(user.id, assignedUserId))
          } else {
            assignedUserId = nid('usr')
            await tx.insert(user).values({
              id: assignedUserId,
              name,
              email,
              phone,
              role: 'rider',
              isActive: true,
            })
          }

          // Upsert into riders table
          const existingRider = await tx
            .select({ id: riders.id })
            .from(riders)
            .where(or(eq(riders.email, email), eq(riders.phone, phone)))
            .limit(1)

          const vehicle = (r.vehicle === 'scooter' || r.vehicle === 'car') ? r.vehicle : 'bike'
          const commissionRate = Math.round(parseNum(r.commissionRatePercent || r.commissionRate, 10))
          const baseSalary = parsePaisa(r.baseSalaryNPR || r.baseSalary, 0)

          if (existingRider.length > 0) {
            if (mode === 'skip') {
              skipped++
              continue
            }
            await tx
              .update(riders)
              .set({
                name,
                email,
                phone,
                vehicle,
                licenseNo: (r.licenseNo || '').trim(),
                zone: (r.zone || 'Butwal Core').trim(),
                commissionRate,
                baseSalary,
                status: (r.status as any) || 'offline',
              })
              .where(eq(riders.id, existingRider[0].id))
            updated++
          } else {
            const riderId = nid('rid')
            await tx.insert(riders).values({
              id: riderId,
              userId: assignedUserId,
              name,
              email,
              phone,
              vehicle,
              licenseNo: (r.licenseNo || '').trim(),
              zone: (r.zone || 'Butwal Core').trim(),
              commissionRate,
              baseSalary,
              status: (r.status as any) || 'offline',
            })
            inserted++
          }
        }
      }

      // 4. CATALOG ITEMS (Products + Variants)
      else if (entity === 'items') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const catType = (r.catalogType || 'liquor').toLowerCase().trim()
          const name = (r.name || '').trim()
          const sku = (r.sku || '').trim()
          const price = parsePaisa(r.priceNPR || r.price, 0)

          if (!name || !sku || price <= 0) {
            errors.push(`Row ${i + 2}: Item requires name, valid sku, and price > 0`)
            continue
          }

          const productSlug = (r.slug || slugify(name)).trim()
          const categorySlug = (r.categorySlug || 'general').trim()
          const brandSlug = (r.brandSlug || '').trim()
          const mrp = parsePaisa(r.mrpNPR || r.mrp, price)
          const stock = Math.round(parseNum(r.stock, 0))

          if (catType === 'grocery') {
            // Find or create grocery category
            let cat = await tx
              .select({ id: groceryCategories.id })
              .from(groceryCategories)
              .where(eq(groceryCategories.slug, categorySlug))
              .limit(1)

            if (cat.length === 0) {
              const [newCat] = await tx
                .insert(groceryCategories)
                .values({
                  name: categorySlug.replace(/-/g, ' ').toUpperCase(),
                  slug: categorySlug,
                  description: 'Auto-created via Super Admin Bulk Import',
                })
                .returning({ id: groceryCategories.id })
              cat = [newCat]
            }

            // Find brand if specified
            let brandId: string | null = null
            if (brandSlug) {
              const b = await tx
                .select({ id: groceryBrands.id })
                .from(groceryBrands)
                .where(eq(groceryBrands.slug, brandSlug))
                .limit(1)
              if (b.length > 0) {
                brandId = b[0].id
              }
            }

            // Find or create grocery product
            let prod = await tx
              .select({ id: groceryProducts.id })
              .from(groceryProducts)
              .where(eq(groceryProducts.slug, productSlug))
              .limit(1)

            if (prod.length === 0) {
              const [newProd] = await tx
                .insert(groceryProducts)
                .values({
                  name,
                  slug: productSlug,
                  categoryId: cat[0].id,
                  brandId: brandId || undefined,
                  description: r.description || null,
                  isFeatured: parseBool(r.isFeatured, false),
                  isActive: parseBool(r.isActive, true),
                })
                .returning({ id: groceryProducts.id })
              prod = [newProd]
            }

            // Upsert variant by SKU
            const existingVar = await tx
              .select({ id: groceryVariants.id })
              .from(groceryVariants)
              .where(eq(groceryVariants.sku, sku))
              .limit(1)

            if (existingVar.length > 0) {
              if (mode === 'skip') {
                skipped++
                continue
              }
              await tx
                .update(groceryVariants)
                .set({
                  name: r.variantName || 'Standard',
                  price,
                  mrp,
                  stock,
                  isActive: parseBool(r.isActive, true),
                })
                .where(eq(groceryVariants.id, existingVar[0].id))
              updated++
            } else {
              await tx.insert(groceryVariants).values({
                productId: prod[0].id,
                name: r.variantName || 'Standard',
                unit: 'pcs',
                quantity: '1',
                sku,
                price,
                mrp,
                stock,
                isActive: parseBool(r.isActive, true),
              })
              inserted++
            }
          } else {
            // Default to Liquor
            let cat = await tx
              .select({ id: liquorCategories.id })
              .from(liquorCategories)
              .where(eq(liquorCategories.slug, categorySlug))
              .limit(1)

            if (cat.length === 0) {
              const [newCat] = await tx
                .insert(liquorCategories)
                .values({
                  name: categorySlug.replace(/-/g, ' ').toUpperCase(),
                  slug: categorySlug,
                  description: 'Auto-created via Super Admin Bulk Import',
                })
                .returning({ id: liquorCategories.id })
              cat = [newCat]
            }

            // Find brand if specified
            let brandId: string | null = null
            if (brandSlug) {
              const b = await tx
                .select({ id: liquorBrands.id })
                .from(liquorBrands)
                .where(eq(liquorBrands.slug, brandSlug))
                .limit(1)
              if (b.length > 0) {
                brandId = b[0].id
              }
            }

            let prod = await tx
              .select({ id: liquorProducts.id })
              .from(liquorProducts)
              .where(eq(liquorProducts.slug, productSlug))
              .limit(1)

            if (prod.length === 0) {
              const [newProd] = await tx
                .insert(liquorProducts)
                .values({
                  name,
                  slug: productSlug,
                  categoryId: cat[0].id,
                  brandId: brandId || undefined,
                  description: r.description || null,
                  isFeatured: parseBool(r.isFeatured, false),
                  isActive: parseBool(r.isActive, true),
                })
                .returning({ id: liquorProducts.id })
              prod = [newProd]
            }

            const existingVar = await tx
              .select({ id: liquorVariants.id })
              .from(liquorVariants)
              .where(eq(liquorVariants.sku, sku))
              .limit(1)

            const volumeMl = Math.round(parseNum(r.volumeMl, 750))
            const rawAbv = r.abv && String(r.abv).trim() ? String(r.abv).trim() : null

            if (existingVar.length > 0) {
              if (mode === 'skip') {
                skipped++
                continue
              }
              await tx
                .update(liquorVariants)
                .set({
                  name: r.variantName || `${volumeMl} ml`,
                  volumeMl,
                  abv: rawAbv !== null ? rawAbv : undefined,
                  price,
                  mrp,
                  stock,
                  isActive: parseBool(r.isActive, true),
                })
                .where(eq(liquorVariants.id, existingVar[0].id))
              updated++
            } else {
              await tx.insert(liquorVariants).values({
                productId: prod[0].id,
                name: r.variantName || `${volumeMl} ml`,
                volumeMl,
                sku,
                abv: rawAbv,
                price,
                mrp,
                stock,
                isActive: parseBool(r.isActive, true),
              })
              inserted++
            }
          }
        }
      }

      // 5. CATEGORIES
      else if (entity === 'categories') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const catType = (r.catalogType || 'liquor').toLowerCase().trim()
          const name = (r.name || '').trim()
          const slug = (r.slug || slugify(name)).trim()

          if (!name || !slug) {
            errors.push(`Row ${i + 2}: Category requires name and slug`)
            continue
          }

          if (catType === 'grocery') {
            const existing = await tx
              .select({ id: groceryCategories.id })
              .from(groceryCategories)
              .where(eq(groceryCategories.slug, slug))
              .limit(1)

            if (existing.length > 0) {
              if (mode === 'skip') {
                skipped++
                continue
              }
              await tx
                .update(groceryCategories)
                .set({
                  name,
                  description: r.description || null,
                  isActive: parseBool(r.isActive, true),
                })
                .where(eq(groceryCategories.slug, slug))
              updated++
            } else {
              await tx.insert(groceryCategories).values({
                name,
                slug,
                description: r.description || null,
                isActive: parseBool(r.isActive, true),
              })
              inserted++
            }
          } else {
            const existing = await tx
              .select({ id: liquorCategories.id })
              .from(liquorCategories)
              .where(eq(liquorCategories.slug, slug))
              .limit(1)

            if (existing.length > 0) {
              if (mode === 'skip') {
                skipped++
                continue
              }
              await tx
                .update(liquorCategories)
                .set({
                  name,
                  description: r.description || null,
                  isActive: parseBool(r.isActive, true),
                })
                .where(eq(liquorCategories.slug, slug))
              updated++
            } else {
              await tx.insert(liquorCategories).values({
                name,
                slug,
                description: r.description || null,
                isActive: parseBool(r.isActive, true),
              })
              inserted++
            }
          }
        }
      }

      // 6. BRANDS
      else if (entity === 'brands') {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          const catType = (r.catalogType || 'liquor').toLowerCase().trim()
          const name = (r.name || '').trim()
          const slug = (r.slug || slugify(name)).trim()

          if (!name || !slug) {
            errors.push(`Row ${i + 2}: Brand requires name and slug`)
            continue
          }

          if (catType === 'grocery') {
            const existing = await tx
              .select({ id: groceryBrands.id })
              .from(groceryBrands)
              .where(eq(groceryBrands.slug, slug))
              .limit(1)

            if (existing.length > 0) {
              if (mode === 'skip') {
                skipped++
                continue
              }
              await tx
                .update(groceryBrands)
                .set({
                  name,
                  origin: r.origin || 'Nepal',
                  description: r.description || null,
                  isActive: parseBool(r.isActive, true),
                })
                .where(eq(groceryBrands.slug, slug))
              updated++
            } else {
              await tx.insert(groceryBrands).values({
                name,
                slug,
                origin: r.origin || 'Nepal',
                description: r.description || null,
                isActive: parseBool(r.isActive, true),
              })
              inserted++
            }
          } else {
            const existing = await tx
              .select({ id: liquorBrands.id })
              .from(liquorBrands)
              .where(eq(liquorBrands.slug, slug))
              .limit(1)

            if (existing.length > 0) {
              if (mode === 'skip') {
                skipped++
                continue
              }
              await tx
                .update(liquorBrands)
                .set({
                  name,
                  origin: r.origin || 'Nepal',
                  description: r.description || null,
                  isActive: parseBool(r.isActive, true),
                })
                .where(eq(liquorBrands.slug, slug))
              updated++
            } else {
              await tx.insert(liquorBrands).values({
                name,
                slug,
                origin: r.origin || 'Nepal',
                description: r.description || null,
                isActive: parseBool(r.isActive, true),
              })
              inserted++
            }
          }
        }
      }
    })

    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'bulk_import',
      `Bulk imported ${entity}: ${inserted} created, ${updated} updated, ${skipped} skipped (${rows.length} total rows processed)`,
    )

    return {
      success: true,
      total: rows.length,
      inserted,
      updated,
      skipped,
      errors,
    }
  })

// ==========================================
// DYNAMIC ADMIN PANEL & SYSTEM MANAGEMENT
// ==========================================

export interface AdminPanelNotice {
  id: string
  title: string
  message: string
  type: 'warning' | 'info' | 'destructive' | 'success'
  actionLabel?: string | null
  actionUrl?: string | null
  active: boolean
  dismissible: boolean
  targetRoles: string[] // ['all'] or ['admin', 'manager', 'rider']
  createdAt: string
  updatedAt: string
}

export interface SupportSettings {
  developerTeamName: string
  contactPhone: string
  supportEmail: string
  whatsappNumber: string
  officeHours: string
  paymentDetails: {
    bankName: string
    accountName: string
    accountNumber: string
    branch: string
    paymentInstructions: string
  }
}

export type WeekdayKey =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'

export interface DaySchedule {
  isOpen: boolean
  openTime: string // "HH:MM" 24h
  closeTime: string // "HH:MM" 24h
}

export interface SystemSettings {
  // Master On/Off Switch
  systemActive: boolean
  deactivationReason: string

  // Dynamic Operating Schedule
  scheduleEnabled: boolean
  weekendOff: boolean
  weekendDays: WeekdayKey[]
  weeklySchedule: Record<WeekdayKey, DaySchedule>

  // Custom Date Closure
  customClosureEnabled: boolean
  customClosureStart: string | null
  customClosureEnd: string | null
  customClosureMessage: string

  // Offline Ordering Policy
  allowAdvanceOrdersWhenClosed: boolean
  showOfflineNotice: boolean
  offlineNoticeMessage: string

  // Emergency Controls
  maintenanceMode: boolean
  maintenanceMessage: string
  orderPlacementFreeze: boolean
  freezeReason: string
  deliveryBlackout: boolean
  blackoutMessage: string
}

export interface WebsiteSettings {
  storefrontNotice: string
  storefrontNoticeActive: boolean
  supportPhone: string
  supportEmail: string
  operatingHours: string
  deliveryPromiseText: string
}

export const DEFAULT_WEEKLY_SCHEDULE: Record<WeekdayKey, DaySchedule> = {
  sunday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  monday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  tuesday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  wednesday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  thursday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  friday: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  saturday: { isOpen: false, openTime: '10:00', closeTime: '23:00' }, // Nepal standard weekend
}

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  developerTeamName: 'Newline Developer & Infrastructure Team',
  contactPhone: '+977 9801234567',
  supportEmail: 'admin@newline.com',
  whatsappNumber: '+977 9801234567',
  officeHours: '24/7 Priority Emergency Support',
  paymentDetails: {
    bankName: 'Nabil Bank Limited',
    accountName: 'Newline Technology Pvt. Ltd.',
    accountNumber: '01201017500123',
    branch: 'Kathmandu Main Branch',
    paymentInstructions: 'Please include Store Identifier (Mezmani) in deposit remarks and email proof to admin@newline.com.',
  },
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  systemActive: true,
  deactivationReason: '',

  scheduleEnabled: true,
  weekendOff: false,
  weekendDays: ['saturday'],
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,

  customClosureEnabled: false,
  customClosureStart: null,
  customClosureEnd: null,
  customClosureMessage: 'Store is temporarily closed for scheduled operations.',

  allowAdvanceOrdersWhenClosed: true,
  showOfflineNotice: true,
  offlineNoticeMessage:
    'Mezmani is currently closed for immediate delivery. Place your order now and it will be delivered after reopening!',

  maintenanceMode: false,
  maintenanceMessage:
    'Mezmani storefront is undergoing scheduled optimization. We will be back shortly.',
  orderPlacementFreeze: false,
  freezeReason: 'Temporary order pause for inventory reconciliation.',
  deliveryBlackout: false,
  blackoutMessage:
    'Delivery is temporarily paused due to adverse weather or road conditions.',
}

const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  storefrontNotice: 'Welcome to Mezmani! Order premier beverages and groceries directly to your doorstep.',
  storefrontNoticeActive: true,
  supportPhone: '+977 9801234567',
  supportEmail: 'support@mezmani.com',
  operatingHours: '10:00 AM - 11:00 PM (Everyday)',
  deliveryPromiseText: 'Guaranteed rapid 45-minute delivery across coverage zones.',
}

const DEFAULT_ADMIN_NOTICES: AdminPanelNotice[] = [
  {
    id: 'ntc_payment_reminder',
    title: 'Payment & Infrastructure Notice',
    message: 'Monthly dedicated cloud database, OTP SMS gateway, and storage infrastructure fee is active. Please review support & payment details.',
    type: 'warning',
    actionLabel: 'View Payment Info',
    actionUrl: '/superadmin?tab=admin-panel',
    active: true,
    dismissible: true,
    targetRoles: ['all'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

async function getSettingJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1)

    if (rows.length === 0 || !rows[0].value) return fallback
    return rows[0].value as T
  } catch {
    return fallback
  }
}

async function setSettingJson<T>(key: string, value: T): Promise<void> {
  const existing = await db
    .select({ key: siteSettings.key })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(siteSettings)
      .set({ value: value as any, updatedAt: new Date() })
      .where(eq(siteSettings.key, key))
  } else {
    await db.insert(siteSettings).values({
      key,
      value: value as any,
    })
  }
}

export const getAdminPanelNoticesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionUser = await getSessionUser()
    const isSuper = isSuperAdmin(sessionUser)
    const userRole = sessionUser.role || 'manager'

    const notices = await getSettingJson<AdminPanelNotice[]>(
      'admin_panel_notices',
      DEFAULT_ADMIN_NOTICES,
    )

    if (isSuper) {
      return { notices }
    }

    // Filter to active notices matching the user role or 'all'
    const visibleNotices = notices.filter(
      (n) => n.active && (n.targetRoles.includes('all') || n.targetRoles.includes(userRole)),
    )
    return { notices: visibleNotices }
  },
)

export const saveAdminPanelNoticeFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        title: z.string().min(2),
        message: z.string().min(3),
        type: z.enum(['warning', 'info', 'destructive', 'success']).default('info'),
        actionLabel: z.string().optional().nullable(),
        actionUrl: z.string().optional().nullable(),
        active: z.boolean().default(true),
        dismissible: z.boolean().default(true),
        targetRoles: z.array(z.string()).default(['all']),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const notices = await getSettingJson<AdminPanelNotice[]>(
      'admin_panel_notices',
      DEFAULT_ADMIN_NOTICES,
    )

    const now = new Date().toISOString()
    const noticeId = data.id || nid('ntc')
    const existingIndex = notices.findIndex((n) => n.id === noticeId)

    const updatedNotice: AdminPanelNotice = {
      id: noticeId,
      title: data.title.trim(),
      message: data.message.trim(),
      type: data.type,
      actionLabel: data.actionLabel?.trim() || null,
      actionUrl: data.actionUrl?.trim() || null,
      active: data.active,
      dismissible: data.dismissible,
      targetRoles: data.targetRoles.length > 0 ? data.targetRoles : ['all'],
      createdAt: existingIndex >= 0 ? notices[existingIndex].createdAt : now,
      updatedAt: now,
    }

    let nextNotices: AdminPanelNotice[]
    if (existingIndex >= 0) {
      nextNotices = [...notices]
      nextNotices[existingIndex] = updatedNotice
    } else {
      nextNotices = [updatedNotice, ...notices]
    }

    await setSettingJson('admin_panel_notices', nextNotices)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      `Saved admin broadcast notice: ${updatedNotice.title} (type: ${updatedNotice.type})`,
    )

    return { success: true, notice: updatedNotice }
  })

export const toggleAdminPanelNoticeFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const notices = await getSettingJson<AdminPanelNotice[]>(
      'admin_panel_notices',
      DEFAULT_ADMIN_NOTICES,
    )

    const nextNotices = notices.map((n) =>
      n.id === data.id ? { ...n, active: data.active, updatedAt: new Date().toISOString() } : n,
    )

    await setSettingJson('admin_panel_notices', nextNotices)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      `Toggled admin notice ${data.id} active state to ${data.active}`,
    )

    return { success: true }
  })

export const deleteAdminPanelNoticeFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const notices = await getSettingJson<AdminPanelNotice[]>(
      'admin_panel_notices',
      DEFAULT_ADMIN_NOTICES,
    )

    const nextNotices = notices.filter((n) => n.id !== data.id)
    await setSettingJson('admin_panel_notices', nextNotices)

    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'delete',
      `Deleted admin broadcast notice ${data.id}`,
    )

    return { success: true }
  })

export const getSuperAdminSupportSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await getSessionUser()
    return getSettingJson<SupportSettings>(
      'superadmin_support_settings',
      DEFAULT_SUPPORT_SETTINGS,
    )
  },
)

export const saveSuperAdminSupportSettingsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        developerTeamName: z.string().min(2),
        contactPhone: z.string().min(5),
        supportEmail: z.string().email(),
        whatsappNumber: z.string().min(5),
        officeHours: z.string().min(2),
        paymentDetails: z.object({
          bankName: z.string().min(2),
          accountName: z.string().min(2),
          accountNumber: z.string().min(2),
          branch: z.string().min(2),
          paymentInstructions: z.string(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    await setSettingJson('superadmin_support_settings', data)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      'Updated developer team support & payment details',
    )
    return { success: true, settings: data }
  })

function format12HourTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr || '0', 10)
  const m = parseInt(mStr || '0', 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function getLocalOperatingTime(date: Date = new Date()): {
  dayKey: WeekdayKey
  timeStr: string
  hours: number
  minutes: number
  year: number
  month: number
  day: number
  dateStr: string
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(date)
    const map: Record<string, string> = {}
    for (const p of parts) {
      map[p.type] = p.value
    }
    const dayName = (map.weekday || '').toLowerCase() as WeekdayKey
    const hour = map.hour || '00'
    const minute = map.minute || '00'
    const year = parseInt(map.year || '2026', 10)
    const month = parseInt(map.month || '1', 10)
    const day = parseInt(map.day || '1', 10)

    const validDays: WeekdayKey[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ]
    const dayKey = validDays.includes(dayName) ? dayName : 'sunday'
    return {
      dayKey,
      timeStr: `${hour}:${minute}`,
      hours: parseInt(hour, 10),
      minutes: parseInt(minute, 10),
      year,
      month,
      day,
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    }
  } catch {
    const days: WeekdayKey[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ]
    const dayKey = days[date.getDay()]
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    const y = date.getFullYear()
    const mo = date.getMonth() + 1
    const d = date.getDate()
    return {
      dayKey,
      timeStr: `${h}:${m}`,
      hours: date.getHours(),
      minutes: date.getMinutes(),
      year: y,
      month: mo,
      day: d,
      dateStr: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    }
  }
}

export interface SystemEvaluationResult {
  isOpen: boolean
  isSystemActive: boolean
  isMaintenanceMode: boolean
  isOrderFreeze: boolean
  isDeliveryBlackout: boolean
  isWithinHours: boolean
  isWeekendClosed: boolean
  isCustomClosed: boolean
  nextOpeningDateTime: string | null
  nextOpeningFormatted: string | null
  allowAdvanceOrders: boolean
  showNotice: boolean
  noticeMessage: string
  canPlaceOrderNow: boolean
  canTakeAdvanceOrder: boolean
  currentDayKey: WeekdayKey
  currentTimeStr: string
}

export function calculateSystemStatus(
  settings: SystemSettings,
  now: Date = new Date(),
): SystemEvaluationResult {
  const local = getLocalOperatingTime(now)
  const isSystemActive = Boolean(settings.systemActive)
  const isMaintenanceMode = Boolean(settings.maintenanceMode)
  const isOrderFreeze = Boolean(settings.orderPlacementFreeze)
  const isDeliveryBlackout = Boolean(settings.deliveryBlackout)

  let isCustomClosed = false
  if (
    settings.customClosureEnabled &&
    settings.customClosureStart &&
    settings.customClosureEnd
  ) {
    const start = new Date(settings.customClosureStart).getTime()
    const end = new Date(settings.customClosureEnd).getTime()
    const cur = now.getTime()
    if (!isNaN(start) && !isNaN(end) && cur >= start && cur < end) {
      isCustomClosed = true
    }
  }

  let isWeekendClosed = false
  if (settings.scheduleEnabled && settings.weekendOff) {
    if (settings.weekendDays?.includes(local.dayKey)) {
      isWeekendClosed = true
    }
  }

  let isWithinHours = true
  if (settings.scheduleEnabled && !isWeekendClosed) {
    const schedule = settings.weeklySchedule?.[local.dayKey]
    if (!schedule || !schedule.isOpen) {
      isWithinHours = false
    } else {
      const open = schedule.openTime || '10:00'
      const close = schedule.closeTime || '23:00'
      if (open < close) {
        isWithinHours = local.timeStr >= open && local.timeStr < close
      } else {
        isWithinHours = local.timeStr >= open || local.timeStr < close
      }
    }
  }

  const isOpen =
    isSystemActive &&
    !isMaintenanceMode &&
    !isCustomClosed &&
    !isWeekendClosed &&
    isWithinHours

  // Calculate Next Opening
  let nextOpeningFormatted: string | null = null
  let nextOpeningDateTime: string | null = null

  if (!isOpen) {
    if (isCustomClosed && settings.customClosureEnd) {
      const endDate = new Date(settings.customClosureEnd)
      nextOpeningDateTime = endDate.toISOString()
      nextOpeningFormatted = endDate.toLocaleString('en-US', {
        timeZone: 'Asia/Kathmandu',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } else if (settings.scheduleEnabled && settings.weeklySchedule) {
      const daysOrder: WeekdayKey[] = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ]
      const currentDayIdx = daysOrder.indexOf(local.dayKey)

      // Search up to 7 days ahead
      for (let offset = 0; offset <= 7; offset++) {
        const nextIdx = (currentDayIdx + offset) % 7
        const nextDayKey = daysOrder[nextIdx]
        const nextSchedule = settings.weeklySchedule[nextDayKey]

        const isWknd = settings.weekendOff && settings.weekendDays?.includes(nextDayKey)
        if (isWknd || !nextSchedule?.isOpen) {
          continue
        }

        const openTime = nextSchedule.openTime || '10:00'

        if (offset === 0) {
          if (local.timeStr < openTime) {
            nextOpeningFormatted = `Today at ${format12HourTime(openTime)}`
            const target = new Date(now)
            const [h, m] = openTime.split(':').map(Number)
            target.setHours(h, m, 0, 0)
            nextOpeningDateTime = target.toISOString()
            break
          }
          continue
        }

        const dayLabel = offset === 1 ? 'Tomorrow' : capitalize(nextDayKey)
        nextOpeningFormatted = `${dayLabel} at ${format12HourTime(openTime)}`
        const target = new Date(now)
        target.setDate(target.getDate() + offset)
        const [h, m] = openTime.split(':').map(Number)
        target.setHours(h, m, 0, 0)
        nextOpeningDateTime = target.toISOString()
        break
      }
    }
  }

  const allowAdvanceOrders =
    Boolean(settings.allowAdvanceOrdersWhenClosed) && !isMaintenanceMode
  const canPlaceOrderNow =
    isOpen && !isOrderFreeze && !isMaintenanceMode && !isDeliveryBlackout
  const canTakeAdvanceOrder = !isOpen && allowAdvanceOrders

  let noticeMessage = ''
  if (!isOpen) {
    if (isMaintenanceMode) {
      noticeMessage =
        settings.maintenanceMessage ||
        'Storefront is undergoing scheduled maintenance. Please visit shortly.'
    } else if (!isSystemActive) {
      noticeMessage =
        settings.deactivationReason ||
        (allowAdvanceOrders
          ? `Store system is offline. You can still order now for scheduled delivery once online${nextOpeningFormatted ? ` (${nextOpeningFormatted})` : ''}!`
          : 'Store system is temporarily deactivated. Immediate and advance ordering is closed.')
    } else if (isCustomClosed) {
      noticeMessage =
        settings.customClosureMessage ||
        `Store is temporarily closed${nextOpeningFormatted ? ` until ${nextOpeningFormatted}` : ''}.`
    } else {
      noticeMessage =
        settings.offlineNoticeMessage ||
        (allowAdvanceOrders
          ? `We are currently closed for immediate delivery. Place your order now and it will be delivered after reopening${nextOpeningFormatted ? ` (${nextOpeningFormatted})` : ''}!`
          : `We are currently closed. Operating hours resume${nextOpeningFormatted ? ` on ${nextOpeningFormatted}` : ''}.`)
    }
  }

  return {
    isOpen,
    isSystemActive,
    isMaintenanceMode,
    isOrderFreeze,
    isDeliveryBlackout,
    isWithinHours,
    isWeekendClosed,
    isCustomClosed,
    nextOpeningDateTime,
    nextOpeningFormatted,
    allowAdvanceOrders,
    showNotice: Boolean(settings.showOfflineNotice) && !isOpen,
    noticeMessage,
    canPlaceOrderNow,
    canTakeAdvanceOrder,
    currentDayKey: local.dayKey,
    currentTimeStr: local.timeStr,
  }
}

const weekdayEnum = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
])

const dayScheduleSchema = z.object({
  isOpen: z.boolean(),
  openTime: z.string(),
  closeTime: z.string(),
})

export const systemSettingsSchema = z.object({
  systemActive: z.boolean().default(true),
  deactivationReason: z.string().default(''),

  scheduleEnabled: z.boolean().default(true),
  weekendOff: z.boolean().default(false),
  weekendDays: z.array(weekdayEnum).default(['saturday']),
  weeklySchedule: z.record(weekdayEnum, dayScheduleSchema),

  customClosureEnabled: z.boolean().default(false),
  customClosureStart: z.string().nullable().optional(),
  customClosureEnd: z.string().nullable().optional(),
  customClosureMessage: z.string().default(''),

  allowAdvanceOrdersWhenClosed: z.boolean().default(true),
  showOfflineNotice: z.boolean().default(true),
  offlineNoticeMessage: z.string().default(''),

  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().default(''),
  orderPlacementFreeze: z.boolean().default(false),
  freezeReason: z.string().default(''),
  deliveryBlackout: z.boolean().default(false),
  blackoutMessage: z.string().default(''),
})

export const getSuperAdminSystemSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const raw = await getSettingJson<Partial<SystemSettings>>(
      'superadmin_system_settings',
      DEFAULT_SYSTEM_SETTINGS,
    )
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...raw,
      weeklySchedule: {
        ...DEFAULT_WEEKLY_SCHEDULE,
        ...(raw.weeklySchedule || {}),
      },
    } as SystemSettings
  },
)

export const getPublicStoreOperatingStatusFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const raw = await getSettingJson<Partial<SystemSettings>>(
      'superadmin_system_settings',
      DEFAULT_SYSTEM_SETTINGS,
    )
    const settings: SystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...raw,
      weeklySchedule: {
        ...DEFAULT_WEEKLY_SCHEDULE,
        ...(raw.weeklySchedule || {}),
      },
    }
    const status = calculateSystemStatus(settings)
    return {
      settings,
      ...status,
    }
  },
)

export const saveSuperAdminSystemSettingsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => systemSettingsSchema.parse(d))
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    await setSettingJson('superadmin_system_settings', data)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      `Updated system settings: active=${data.systemActive}, schedule=${data.scheduleEnabled}, weekendOff=${data.weekendOff}, advanceOrders=${data.allowAdvanceOrdersWhenClosed}`,
    )
    return { success: true, settings: data }
  })

export const getSuperAdminWebsiteSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getSettingJson<WebsiteSettings>(
      'superadmin_website_settings',
      DEFAULT_WEBSITE_SETTINGS,
    )
  },
)

export const saveSuperAdminWebsiteSettingsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        storefrontNotice: z.string(),
        storefrontNoticeActive: z.boolean(),
        supportPhone: z.string(),
        supportEmail: z.string().email(),
        operatingHours: z.string(),
        deliveryPromiseText: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    await setSettingJson('superadmin_website_settings', data)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      'Updated website storefront notice and public contact settings',
    )
    return { success: true, settings: data }
  })

export interface FeatureFlagsSettings {
  enableCod: boolean
  enableEsewa: boolean
  enableKhalti: boolean
  enableFonepay: boolean
  enableAgeVerificationModal: boolean
  minAgeRequirement: number
  enableGuestCheckout: boolean
  enableRiderAutoAssign: boolean
  enableOrderSms: boolean
  smsGatewayProvider: 'sparrow' | 'aakash' | 'mock'
  enableStrictStockCheck: boolean
  enablePreorders: boolean
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlagsSettings = {
  enableCod: true,
  enableEsewa: true,
  enableKhalti: false,
  enableFonepay: false,
  enableAgeVerificationModal: true,
  minAgeRequirement: 18,
  enableGuestCheckout: false,
  enableRiderAutoAssign: false,
  enableOrderSms: true,
  smsGatewayProvider: 'sparrow',
  enableStrictStockCheck: true,
  enablePreorders: false,
}

export const getSuperAdminFeatureFlagsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getSettingJson<FeatureFlagsSettings>(
      'superadmin_feature_flags',
      DEFAULT_FEATURE_FLAGS,
    )
  },
)

export const saveSuperAdminFeatureFlagsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        enableCod: z.boolean(),
        enableEsewa: z.boolean(),
        enableKhalti: z.boolean(),
        enableFonepay: z.boolean(),
        enableAgeVerificationModal: z.boolean(),
        minAgeRequirement: z.number().int().min(16).max(25),
        enableGuestCheckout: z.boolean(),
        enableRiderAutoAssign: z.boolean(),
        enableOrderSms: z.boolean(),
        smsGatewayProvider: z.enum(['sparrow', 'aakash', 'mock']),
        enableStrictStockCheck: z.boolean(),
        enablePreorders: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    await setSettingJson('superadmin_feature_flags', data)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      `Updated feature flags: COD=${data.enableCod}, eSewa=${data.enableEsewa}, SMS=${data.smsGatewayProvider}`,
    )
    return { success: true, settings: data }
  })

export interface PricingRulesSettings {
  baseDeliveryCharge: number
  freeDeliveryThreshold: number
  perKmCharge: number
  nightSurcharge: number
  nightSurchargeStartHour: number
  nightSurchargeEndHour: number
  enableVat: boolean
  vatRatePercent: number
  serviceChargePercent: number
}

export const DEFAULT_PRICING_RULES: PricingRulesSettings = {
  baseDeliveryCharge: 100,
  freeDeliveryThreshold: 3000,
  perKmCharge: 25,
  nightSurcharge: 50,
  nightSurchargeStartHour: 21,
  nightSurchargeEndHour: 6,
  enableVat: true,
  vatRatePercent: 13,
  serviceChargePercent: 0,
}

export const getSuperAdminPricingRulesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getSettingJson<PricingRulesSettings>(
      'superadmin_pricing_rules',
      DEFAULT_PRICING_RULES,
    )
  },
)

export const saveSuperAdminPricingRulesFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        baseDeliveryCharge: z.number().min(0),
        freeDeliveryThreshold: z.number().min(0),
        perKmCharge: z.number().min(0),
        nightSurcharge: z.number().min(0),
        nightSurchargeStartHour: z.number().int().min(0).max(23),
        nightSurchargeEndHour: z.number().int().min(0).max(23),
        enableVat: z.boolean(),
        vatRatePercent: z.number().min(0).max(50),
        serviceChargePercent: z.number().min(0).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    await setSettingJson('superadmin_pricing_rules', data)
    await logAudit(
      sessionUser.name || 'Developer Super Admin',
      'superadmin',
      'edit',
      `Updated pricing rules: BaseDelivery=${data.baseDeliveryCharge}, FreeThreshold=${data.freeDeliveryThreshold}, VAT=${data.vatRatePercent}%`,
    )
    return { success: true, settings: data }
  })

export interface SystemTelemetry {
  environment: string
  nodeVersion: string
  uptimeSeconds: number
  memoryUsageMb: {
    rss: number
    heapTotal: number
    heapUsed: number
  }
  dbStatus: 'connected' | 'degraded' | 'disconnected'
  dbLatencyMs: number
  serverTimestamp: string
}

export const getSuperAdminTelemetryFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SystemTelemetry> => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const t0 = Date.now()
    let dbStatus: 'connected' | 'degraded' | 'disconnected' = 'connected'
    try {
      await db.execute(sql`SELECT 1`)
    } catch {
      dbStatus = 'disconnected'
    }
    const dbLatencyMs = Date.now() - t0

    const mem = process.memoryUsage()
    return {
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      },
      dbStatus,
      dbLatencyMs,
      serverTimestamp: new Date().toISOString(),
    }
  },
)

export const getSuperAdminAuditLogsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(50),
      })
      .default({ limit: 50 })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(data.limit)

    return logs
  })

export const exportSuperAdminAuditLogsFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const sessionUser = await getSessionUser()
    if (!isSuperAdmin(sessionUser)) {
      throw new Error('403: Forbidden: Developer Super Admin access required')
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(500)

    const csv = generateCsvString(
      [
        { header: 'ID', key: 'id' },
        { header: 'Timestamp', value: (l) => (l.createdAt ? new Date(l.createdAt).toISOString() : '') },
        { header: 'Actor', key: 'actor' },
        { header: 'Module', key: 'module' },
        { header: 'Action', key: 'action' },
        { header: 'Detail', key: 'detail' },
      ],
      logs,
    )
    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    return { csv, filename, count: logs.length }
  },
)
