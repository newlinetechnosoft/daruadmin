import { beforeAll, describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import * as schema from '#/db/schema'
import type { DbTx } from '#/db'
import {
  upsertLiquorProductQuery,
  upsertFoodProductQuery,
  deleteItemQuery,
} from '#/server/catalog/catalog.queries'
import {
  upsertDealerQuery,
  deleteDealerQuery,
  assignDealerItemsQuery,
  assignItemDealersQuery,
} from '#/server/inventory/inventory.queries'
import { restoreRecycleBinItemQuery } from '#/server/recycle-bin/recycle-bin.queries'
import { deleteRiderQuery } from '#/server/riders/rider.queries'
import { saveUserPermissionsQuery } from '#/server/platform/platform.queries'

describe('Transaction Safety for Multi-Step Writes (INFRA-1)', () => {
  let pglite: PGlite
  let db: ReturnType<typeof drizzle<typeof schema>>

  const catWhiskyId = '11111111-1111-4111-8111-111111111111'
  const catSnacksId = '22222222-2222-4222-8222-222222222222'
  const seededProdId = '33333333-3333-4333-8333-333333333333'

  beforeAll(async () => {
    pglite = new PGlite()
    db = drizzle(pglite, { schema })

    const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))

    // Apply all migrations (0000 through 0017) in sequence
    for (const entry of journal.entries) {
      const filePath = path.join(migrationsFolder, `${entry.tag}.sql`)
      const sqlContent = fs.readFileSync(filePath, 'utf-8')
      const statements = sqlContent.split('--> statement-breakpoint')
      for (const stmt of statements) {
        const trimmed = stmt.trim()
        if (trimmed) {
          await pglite.exec(trimmed)
        }
      }
    }

    // Seed test categories with valid UUIDs
    await db.insert(schema.liquorCategories).values({
      id: catWhiskyId,
      name: 'Test Whisky',
      slug: 'test-whisky',
    })

    await db.insert(schema.foodCategories).values({
      id: catSnacksId,
      name: 'Test Snacks',
      slug: 'test-snacks',
    })

    // Seed test product with valid UUID
    await db.insert(schema.liquorProducts).values({
      id: seededProdId,
      name: 'Seeded Whisky',
      slug: 'seeded-whisky',
      categoryId: catWhiskyId,
    })
  })

  describe('1. upsertLiquorProductQuery transaction safety', () => {
    it('rolls back product, variants, and images completely when a secondary step fails', async () => {
      let createdProdId: string | undefined
      let errorThrown = false

      try {
        await db.transaction(async (tx) => {
          const res = await upsertLiquorProductQuery(
            {
              name: 'Rollback Whiskey',
              slug: 'rollback-whiskey',
              categoryId: catWhiskyId,
              isActive: true,
              isFeatured: false,
              variants: [
                {
                  name: '750ml',
                  volumeMl: 750,
                  sku: 'SKU-LIQ-RB-1',
                  price: 350000,
                  stock: 10,
                  isActive: true,
                },
              ],
              images: [
                {
                  url: 'https://example.com/rb.jpg',
                  isPrimary: true,
                  sortOrder: 0,
                },
              ],
            },
            tx as unknown as DbTx,
          )
          createdProdId = res.productId

          // Simulate an unexpected downstream failure in the same transaction
          throw new Error('Simulated failure during liquor product upsert')
        })
      } catch (err: any) {
        if (err.message === 'Simulated failure during liquor product upsert') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)
      expect(createdProdId).toBeDefined()

      // Verify that NO product, variant, or image records were committed
      const prodRows = await db
        .select()
        .from(schema.liquorProducts)
        .where(eq(schema.liquorProducts.id, createdProdId!))
      expect(prodRows.length).toBe(0)

      const variantRows = await db
        .select()
        .from(schema.liquorVariants)
        .where(eq(schema.liquorVariants.productId, createdProdId!))
      expect(variantRows.length).toBe(0)

      const imageRows = await db
        .select()
        .from(schema.liquorImages)
        .where(eq(schema.liquorImages.productId, createdProdId!))
      expect(imageRows.length).toBe(0)
    })

    it('commits product, variants, and images cleanly on successful transaction', async () => {
      let createdProdId: string | undefined

      await db.transaction(async (tx) => {
        const res = await upsertLiquorProductQuery(
          {
            name: 'Success Whiskey',
            slug: 'success-whiskey',
            categoryId: catWhiskyId,
            isActive: true,
            isFeatured: false,
            variants: [
              {
                name: '750ml',
                volumeMl: 750,
                sku: 'SKU-LIQ-SUCC-1',
                price: 450000,
                stock: 20,
                isActive: true,
              },
            ],
            images: [
              {
                url: 'https://example.com/succ.jpg',
                isPrimary: true,
                sortOrder: 0,
              },
            ],
          },
          tx as unknown as DbTx,
        )
        createdProdId = res.productId
      })

      expect(createdProdId).toBeDefined()

      const prodRows = await db
        .select()
        .from(schema.liquorProducts)
        .where(eq(schema.liquorProducts.id, createdProdId!))
      expect(prodRows.length).toBe(1)
      expect(prodRows[0].name).toBe('Success Whiskey')

      const variantRows = await db
        .select()
        .from(schema.liquorVariants)
        .where(eq(schema.liquorVariants.productId, createdProdId!))
      expect(variantRows.length).toBe(1)
      expect(variantRows[0].sku).toBe('SKU-LIQ-SUCC-1')

      const imageRows = await db
        .select()
        .from(schema.liquorImages)
        .where(eq(schema.liquorImages.productId, createdProdId!))
      expect(imageRows.length).toBe(1)
    })

    it('deleteItemQuery rolls back deletion and recycle bin archiving when aborted', async () => {
      const prodId = crypto.randomUUID()
      await db.insert(schema.liquorProducts).values({
        id: prodId,
        name: 'Product To Delete Safely',
        slug: 'prod-to-delete-safely',
        categoryId: catWhiskyId,
      })

      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await deleteItemQuery(
            { id: prodId, catalogType: 'liquor' },
            tx as unknown as DbTx,
          )
          throw new Error('Catalog delete aborted mid-transaction')
        })
      } catch (err: any) {
        if (err.message === 'Catalog delete aborted mid-transaction') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Product must still exist
      const prodRows = await db
        .select()
        .from(schema.liquorProducts)
        .where(eq(schema.liquorProducts.id, prodId))
      expect(prodRows.length).toBe(1)

      // Recycle bin must NOT have this item
      const rbRows = await db
        .select()
        .from(schema.recycleBin)
        .where(eq(schema.recycleBin.entityId, prodId))
      expect(rbRows.length).toBe(0)
    })
  })

  describe('2. upsertFoodProductQuery transaction safety', () => {
    it('rolls back food product, variants, and images completely when aborted', async () => {
      let createdProdId: string | undefined
      let errorThrown = false

      try {
        await db.transaction(async (tx) => {
          const res = await upsertFoodProductQuery(
            {
              name: 'Rollback Chips',
              slug: 'rollback-chips',
              categoryId: catSnacksId,
              isActive: true,
              isFeatured: false,
              variants: [
                {
                  name: 'Large Pack',
                  quantity: '1',
                  unit: 'pack',
                  sku: 'SKU-FOOD-RB-1',
                  price: 15000,
                  stock: 50,
                  isActive: true,
                },
              ],
              images: [
                {
                  url: 'https://example.com/chips.jpg',
                  isPrimary: true,
                  sortOrder: 0,
                },
              ],
            },
            tx as unknown as DbTx,
          )
          createdProdId = res.productId

          throw new Error('Simulated failure during food product upsert')
        })
      } catch (err: any) {
        if (err.message === 'Simulated failure during food product upsert') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)
      expect(createdProdId).toBeDefined()

      const prodRows = await db
        .select()
        .from(schema.foodProducts)
        .where(eq(schema.foodProducts.id, createdProdId!))
      expect(prodRows.length).toBe(0)

      const variantRows = await db
        .select()
        .from(schema.foodVariants)
        .where(eq(schema.foodVariants.productId, createdProdId!))
      expect(variantRows.length).toBe(0)
    })
  })

  describe('3. Dealer mutations & price history transaction safety', () => {
    it('rolls back dealer, dealerItems, and dealerPriceHistory when transaction aborts', async () => {
      const dealerId = 'dealer_test_rb_1'
      const prodId = '33333333-3333-4333-8333-333333333333'

      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await upsertDealerQuery(
            {
              id: dealerId,
              name: 'Rollback Dealer',
              contact: '9800000001',
              address: 'Traffic Chowk, Butwal',
              city: 'Butwal',
              providesVatBill: true,
              tdsRate: 1.5,
              creditLimit: 5000000,
              paymentTermsDays: 15,
              openingBalance: 0,
              isActive: true,
              assignedItems: [
                {
                  catalogType: 'liquor',
                  productId: prodId,
                  costPrice: 400000,
                  isAvailable: true,
                },
              ],
            },
            tx as unknown as DbTx,
          )

          throw new Error('Dealer transaction abort simulation')
        })
      } catch (err: any) {
        if (err.message === 'Dealer transaction abort simulation') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Dealer must not exist
      const dealerRows = await db
        .select()
        .from(schema.dealers)
        .where(eq(schema.dealers.id, dealerId))
      expect(dealerRows.length).toBe(0)

      // Assigned items must not exist
      const itemRows = await db
        .select()
        .from(schema.dealerItems)
        .where(eq(schema.dealerItems.dealerId, dealerId))
      expect(itemRows.length).toBe(0)

      // Price history must not exist
      const priceRows = await db
        .select()
        .from(schema.dealerPriceHistory)
        .where(eq(schema.dealerPriceHistory.dealerId, dealerId))
      expect(priceRows.length).toBe(0)
    })

    it('assignDealerItemsQuery preserves original items when aborted mid-operation', async () => {
      const dealerId = 'dealer_test_items_rb'
      const prodId1 = '33333333-3333-4333-8333-333333333333'
      const prodId2 = crypto.randomUUID()

      // First create dealer cleanly
      await db.transaction(async (tx) => {
        await upsertDealerQuery(
          {
            id: dealerId,
            name: 'Original Dealer',
            contact: '9800000002',
            address: 'Amarpath, Butwal',
            city: 'Butwal',
            providesVatBill: false,
            tdsRate: 0,
            creditLimit: 0,
            paymentTermsDays: 0,
            openingBalance: 0,
            isActive: true,
            assignedItems: [
              {
                catalogType: 'liquor',
                productId: prodId1,
                costPrice: 400000,
                isAvailable: true,
              },
            ],
          },
          tx as unknown as DbTx,
        )
      })

      // Verify original item is there
      const initialItems = await db
        .select()
        .from(schema.dealerItems)
        .where(eq(schema.dealerItems.dealerId, dealerId))
      expect(initialItems.length).toBe(1)

      // Now attempt to reassign items in a failing transaction
      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await assignDealerItemsQuery(
            {
              dealerId,
              items: [
                {
                  catalogType: 'food',
                  productId: prodId2,
                },
              ],
            },
            tx as unknown as DbTx,
          )

          throw new Error('Reassign items aborted')
        })
      } catch (err: any) {
        if (err.message === 'Reassign items aborted') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Original item must STILL be there, and dummy item must NOT be there
      const finalItems = await db
        .select()
        .from(schema.dealerItems)
        .where(eq(schema.dealerItems.dealerId, dealerId))
      expect(finalItems.length).toBe(1)
      expect(finalItems[0].productId).toBe(prodId1)
      expect(finalItems[0].catalogType).toBe('liquor')
    })

    it('assignItemDealersQuery preserves original dealers when aborted mid-operation', async () => {
      const prodId = crypto.randomUUID()
      await db.insert(schema.liquorProducts).values({
        id: prodId,
        name: 'Item Dealers Rollback Test',
        slug: 'item-dealers-rb',
        categoryId: catWhiskyId,
      })

      const d1 = 'dealer_id_1'
      const d2 = 'dealer_id_2'
      await db.insert(schema.dealers).values([
        {
          id: d1,
          name: 'Dealer One',
          contact: '9811111111',
          address: 'A',
          city: 'Butwal',
        },
        {
          id: d2,
          name: 'Dealer Two',
          contact: '9822222222',
          address: 'B',
          city: 'Butwal',
        },
      ])

      // Initial assignment
      await db.insert(schema.dealerItems).values([
        {
          id: 'di_1',
          dealerId: d1,
          catalogType: 'liquor',
          productId: prodId,
        },
      ])

      // Try reassigning in an aborted transaction
      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await assignItemDealersQuery(
            {
              catalogType: 'liquor',
              productId: prodId,
              dealerIds: [d2],
            },
            tx as unknown as DbTx,
          )

          throw new Error('Assign item dealers aborted')
        })
      } catch (err: any) {
        if (err.message === 'Assign item dealers aborted') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Verified original assignment to d1 was preserved
      const items = await db
        .select()
        .from(schema.dealerItems)
        .where(eq(schema.dealerItems.productId, prodId))
      expect(items.length).toBe(1)
      expect(items[0].dealerId).toBe(d1)
    })

    it('deleteDealerQuery rolls back deletion and recycle bin row when aborted', async () => {
      const dealerId = 'dealer_test_del_rb'
      const prodId = '33333333-3333-4333-8333-333333333333'
      await db.insert(schema.dealers).values({
        id: dealerId,
        name: 'Dealer To Delete',
        contact: '9833333333',
        address: 'Milanchowk',
        city: 'Butwal',
      })

      await db.insert(schema.dealerItems).values({
        id: 'di_del_1',
        dealerId,
        catalogType: 'liquor',
        productId: prodId,
      })

      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await deleteDealerQuery(dealerId, tx as unknown as DbTx)
          throw new Error('Simulated failure during delete dealer')
        })
      } catch (err: any) {
        if (err.message === 'Simulated failure during delete dealer') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Dealer and items must still exist
      const dRows = await db
        .select()
        .from(schema.dealers)
        .where(eq(schema.dealers.id, dealerId))
      expect(dRows.length).toBe(1)

      const diRows = await db
        .select()
        .from(schema.dealerItems)
        .where(eq(schema.dealerItems.dealerId, dealerId))
      expect(diRows.length).toBe(1)

      // Recycle bin row must NOT exist
      const rbRows = await db
        .select()
        .from(schema.recycleBin)
        .where(eq(schema.recycleBin.entityId, dealerId))
      expect(rbRows.length).toBe(0)
    })
  })

  describe('4. restoreRecycleBinItemQuery transaction safety', () => {
    it('does not remove recycle_bin row if restoring entity fails mid-transaction', async () => {
      const rbId = 'rb_item_fail_restore'
      const fakeProdId = crypto.randomUUID()

      // Put an item in recycle bin with broken variant (violates NOT NULL or invalid volume)
      await db.insert(schema.recycleBin).values({
        id: rbId,
        entityType: 'liquor_product',
        entityId: fakeProdId,
        name: 'Broken Product',
        data: {
          product: {
            id: fakeProdId,
            name: 'Broken Product',
            slug: 'broken-prod',
            categoryId: catWhiskyId,
          },
          variants: [
            {
              id: crypto.randomUUID(),
              name: null as unknown as string, // violates notNull on liquor_variants.name
              volumeMl: 750,
              sku: 'BROKEN-SKU',
            },
          ],
        },
        deletedBy: 'Admin',
        deletedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      })

      let failed = false
      try {
        await db.transaction(async (tx) => {
          await restoreRecycleBinItemQuery(rbId, tx as unknown as DbTx)
        })
      } catch {
        failed = true
      }

      expect(failed).toBe(true)

      // The item MUST still be in the recycle bin!
      const rbRows = await db
        .select()
        .from(schema.recycleBin)
        .where(eq(schema.recycleBin.id, rbId))
      expect(rbRows.length).toBe(1)

      // The product MUST NOT have been inserted
      const prodRows = await db
        .select()
        .from(schema.liquorProducts)
        .where(eq(schema.liquorProducts.id, fakeProdId))
      expect(prodRows.length).toBe(0)
    })
  })

  describe('5. deleteRiderQuery transaction safety', () => {
    it('rolls back rider detachment, user role change, and recycle bin row when aborted', async () => {
      const riderUserId = 'usr_rider_del_rb'
      const riderId = 'rider_del_rb_1'
      const orderId = 'ord_rider_del_rb_1'

      // Seed user, rider, order
      await db.insert(schema.user).values({
        id: riderUserId,
        name: 'Test Rider User',
        email: 'rider.del@example.com',
        role: 'rider',
      })

      await db.insert(schema.riders).values({
        id: riderId,
        userId: riderUserId,
        name: 'Test Rider',
        email: 'rider.del@example.com',
        phone: '9840000001',
        cashOnHand: 0,
      })

      await db.insert(schema.orders).values({
        id: orderId,
        number: 'ORD-RIDER-RB-1',
        customerId: riderUserId,
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        customerPhone: '9800000003',
        address: 'Traffic Chowk',
        city: 'Butwal',
        trackingCode: 'TRK-RB-1',
        riderId,
        status: 'delivered', // delivered so delete is permitted
        paymentMethod: 'cod',
        paymentStatus: 'paid',
        subtotal: 100000,
        total: 100000,
      })

      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await deleteRiderQuery(riderId, tx as unknown as DbTx)
          throw new Error('Delete rider aborted mid-way')
        })
      } catch (err: any) {
        if (err.message === 'Delete rider aborted mid-way') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Order must STILL be attached to rider
      const [ord] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
      expect(ord.riderId).toBe(riderId)

      // User role must STILL be 'rider' (not reverted to 'customer')
      const [u] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, riderUserId))
      expect(u.role).toBe('rider')

      // Rider record must STILL exist
      const riderRows = await db
        .select()
        .from(schema.riders)
        .where(eq(schema.riders.id, riderId))
      expect(riderRows.length).toBe(1)

      // Recycle bin must NOT have rider entry
      const rbRows = await db
        .select()
        .from(schema.recycleBin)
        .where(eq(schema.recycleBin.entityId, riderId))
      expect(rbRows.length).toBe(0)
    })
  })

  describe('6. saveUserPermissionsQuery transaction safety', () => {
    it('rolls back all permissions in a batch if aborted mid-loop', async () => {
      const targetUserId = 'usr_perm_test_1'
      await db.insert(schema.user).values({
        id: targetUserId,
        name: 'Perm Target User',
        email: 'perm.target@example.com',
        role: 'customer',
      })

      let errorThrown = false
      try {
        await db.transaction(async (tx) => {
          await saveUserPermissionsQuery(
            targetUserId,
            {
              catalog: ['view', 'create'],
              dealers: ['view'],
            },
            tx as unknown as DbTx,
          )

          throw new Error('Permissions abort simulation')
        })
      } catch (err: any) {
        if (err.message === 'Permissions abort simulation') {
          errorThrown = true
        }
      }

      expect(errorThrown).toBe(true)

      // Zero permissions must have been saved
      const perms = await db
        .select()
        .from(schema.userPermissions)
        .where(eq(schema.userPermissions.userId, targetUserId))
      expect(perms.length).toBe(0)
    })
  })
})
