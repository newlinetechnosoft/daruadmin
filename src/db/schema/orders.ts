import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { dealers } from './inventory'

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
    isLegacy: boolean('is_legacy').notNull().default(false),
    deliveryOtp: text('delivery_otp'),
    deliveryProofPhotoUrl: text('delivery_proof_photo_url'),
    cancellationReason: text('cancellation_reason'),
    deliveryFailureReason: text('delivery_failure_reason'),
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
    index('orders_delivery_otp_idx').on(table.deliveryOtp),
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
    dealerId: text('dealer_id').references(() => dealers.id, {
      onDelete: 'set null',
    }),
    dealerCostPrice: integer('dealer_cost_price'), // snapshotted dealer unit cost (paisa)
    actualDealerCostPrice: integer('actual_dealer_cost_price'), // actual rider-paid unit cost (paisa)
    dealerBillPhotoUrl: text('dealer_bill_photo_url'),
    sourcingStatus: text('sourcing_status').notNull().default('pending'), // 'pending' | 'assigned' | 'unavailable' | 'picked_up'
    isSettled: boolean('is_settled').notNull().default(false),
    settlementId: text('settlement_id'),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_variant_id_idx').on(table.variantId),
    index('order_items_dealer_id_idx').on(table.dealerId),
    index('order_items_sourcing_status_idx').on(table.sourcingStatus),
    index('order_items_settlement_id_idx').on(table.settlementId),
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
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    note: text('note').notNull(),
    actor: text('actor').notNull(),
    actorId: text('actor_id'),
    actorRole: text('actor_role'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('order_status_history_order_id_idx').on(table.orderId),
    index('order_status_history_to_status_idx').on(table.toStatus),
  ],
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
  dealer: one(dealers, {
    fields: [orderItems.dealerId],
    references: [dealers.id],
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
