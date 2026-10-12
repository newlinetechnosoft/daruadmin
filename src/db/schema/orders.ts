import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull().unique(),
    customerId: text('customer_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    landmark: text('landmark'),
    lat: numeric('lat', { precision: 10, scale: 7 }),
    lng: numeric('lng', { precision: 10, scale: 7 }),
    status: text('status').notNull().default('pending'),
    paymentMethod: text('payment_method').notNull(),
    paymentStatus: text('payment_status').notNull().default('pending'),
    subtotal: integer('subtotal').notNull(), // paisa
    deliveryCharge: integer('delivery_charge').notNull().default(0), // paisa
    discount: integer('discount').notNull().default(0), // paisa
    tax: integer('tax').notNull().default(0), // paisa
    total: integer('total').notNull(), // paisa
    riderId: text('rider_id'),
    dealerId: text('dealer_id'),
    trackingCode: text('tracking_code').notNull(),
    notes: text('notes').notNull().default(''),
    couponCode: text('coupon_code'),
    idempotencyKey: text('idempotency_key'),
    ageVerifiedAtDelivery: boolean('age_verified_at_delivery')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('orders_status_idx').on(table.status),
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_rider_id_idx').on(table.riderId),
    index('orders_dealer_id_idx').on(table.dealerId),
    index('orders_created_at_idx').on(table.createdAt),
    index('orders_number_idx').on(table.number),
    index('orders_idempotency_idx').on(table.idempotencyKey),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    catalogType: text('catalog_type').notNull(), // 'liquor' | 'grocery'
    productId: text('product_id').notNull(),
    variantId: text('variant_id').notNull(),
    name: text('name').notNull(),
    variantName: text('variant_name').notNull(),
    sku: text('sku').notNull(),
    qty: integer('qty').notNull(),
    unitPrice: integer('unit_price').notNull(), // in paisa
    lineTotal: integer('line_total').notNull(), // in paisa
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_variant_id_idx').on(table.variantId),
  ],
)

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    note: text('note').notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('order_status_history_order_id_idx').on(table.orderId)],
)

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(user, {
    fields: [orders.customerId],
    references: [user.id],
  }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}))

export const orderStatusHistoryRelations = relations(
  orderStatusHistory,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStatusHistory.orderId],
      references: [orders.id],
    }),
  }),
)
