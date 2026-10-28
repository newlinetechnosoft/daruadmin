import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const dealers = pgTable(
  'dealers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    contact: text('contact').notNull(),
    whatsappNumber: text('whatsapp_number'),
    pan: text('pan'),
    vatNumber: text('vat_number'),
    providesVatBill: boolean('provides_vat_bill').notNull().default(false),
    tdsRate: numeric('tds_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    creditLimit: integer('credit_limit').notNull().default(0), // paisa
    paymentTermsDays: integer('payment_terms_days').notNull().default(0),
    openingBalance: integer('opening_balance').notNull().default(0), // paisa
    address: text('address').notNull(),
    city: text('city').notNull().default('Kathmandu'),
    lat: numeric('lat', { precision: 10, scale: 7 }),
    lng: numeric('lng', { precision: 10, scale: 7 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('dealers_is_active_idx').on(table.isActive)],
)

export const dealerItems = pgTable(
  'dealer_items',
  {
    id: text('id').primaryKey(),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    catalogType: text('catalog_type').notNull(), // 'liquor' | 'grocery'
    productId: uuid('product_id').notNull(),
    costPrice: integer('cost_price').notNull().default(0), // in paisa
    isAvailable: boolean('is_available').notNull().default(true),
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('dealer_items_dealer_id_idx').on(table.dealerId),
    index('dealer_items_product_idx').on(table.catalogType, table.productId),
    uniqueIndex('dealer_items_unique_idx').on(
      table.dealerId,
      table.catalogType,
      table.productId,
    ),
  ],
)

export const dealerPriceHistory = pgTable(
  'dealer_price_history',
  {
    id: text('id').primaryKey(),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    catalogType: text('catalog_type').notNull(), // 'liquor' | 'grocery'
    productId: uuid('product_id').notNull(),
    costPrice: integer('cost_price').notNull(), // paisa
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('dealer_price_history_dealer_idx').on(table.dealerId),
    index('dealer_price_history_product_idx').on(
      table.catalogType,
      table.productId,
    ),
  ],
)

export const dealerStock = pgTable(
  'dealer_stock',
  {
    id: text('id').primaryKey(),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    catalogType: text('catalog_type').notNull(), // 'liquor' | 'grocery'
    variantId: text('variant_id').notNull(),
    qty: integer('qty').notNull().default(0),
    costPrice: integer('cost_price').notNull().default(0), // paisa
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('dealer_stock_dealer_id_idx').on(table.dealerId),
    index('dealer_stock_variant_id_idx').on(table.variantId),
    uniqueIndex('dealer_stock_unique_idx').on(
      table.dealerId,
      table.catalogType,
      table.variantId,
    ),
  ],
)

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: text('id').primaryKey(),
    catalogType: text('catalog_type').notNull(), // 'liquor' | 'grocery'
    variantId: text('variant_id').notNull(),
    dealerId: text('dealer_id').references(() => dealers.id, {
      onDelete: 'set null',
    }),
    delta: integer('delta').notNull(),
    type: text('type').notNull(), // 'purchase' | 'sale' | 'adjustment' | 'return' | 'wastage'
    refType: text('ref_type'), // 'order' | 'manual' | 'purchase'
    refId: text('ref_id'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('stock_movements_variant_idx').on(table.catalogType, table.variantId),
    index('stock_movements_dealer_id_idx').on(table.dealerId),
    index('stock_movements_created_at_idx').on(table.createdAt),
  ],
)

export const dealersRelations = relations(dealers, ({ many }) => ({
  stock: many(dealerStock),
  items: many(dealerItems),
  movements: many(stockMovements),
}))

export const dealerItemsRelations = relations(dealerItems, ({ one }) => ({
  dealer: one(dealers, {
    fields: [dealerItems.dealerId],
    references: [dealers.id],
  }),
}))

export const dealerStockRelations = relations(dealerStock, ({ one }) => ({
  dealer: one(dealers, {
    fields: [dealerStock.dealerId],
    references: [dealers.id],
  }),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  dealer: one(dealers, {
    fields: [stockMovements.dealerId],
    references: [dealers.id],
  }),
}))
