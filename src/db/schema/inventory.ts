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
} from 'drizzle-orm/pg-core'

export const dealers = pgTable(
  'dealers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    contact: text('contact').notNull(),
    pan: text('pan'),
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
  movements: many(stockMovements),
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
