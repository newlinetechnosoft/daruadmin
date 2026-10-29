import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { orders } from './orders'

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    type: text('type').notNull(), // 'order' | 'stock' | 'rider' | 'finance' | 'system'
    read: boolean('read').notNull().default(false),
    href: text('href').notNull().default(''),
    userId: text('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('notifications_read_idx').on(table.read),
    index('notifications_type_idx').on(table.type),
    index('notifications_created_at_idx').on(table.createdAt),
    index('notifications_user_id_idx').on(table.userId),
  ],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actor: text('actor').notNull(),
    module: text('module').notNull(),
    action: text('action').notNull(),
    detail: text('detail').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('audit_logs_module_idx').on(table.module),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
)

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const userPermissions = pgTable(
  'user_permissions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    module: text('module').notNull(),
    actions: text('actions').array().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('user_permissions_user_id_idx').on(table.userId),
    uniqueIndex('user_permissions_user_module_idx').on(
      table.userId,
      table.module,
    ),
  ],
)

export const coupons = pgTable(
  'coupons',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    type: text('type').notNull(), // 'percent' | 'fixed'
    value: integer('value').notNull(), // percentage or paisa
    minOrder: integer('min_order').notNull().default(0), // paisa
    usageLimit: integer('usage_limit').notNull().default(100),
    used: integer('used').notNull().default(0),
    perCustomerLimit: integer('per_customer_limit').notNull().default(1),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    active: boolean('active').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('coupons_code_idx').on(table.code),
    index('coupons_active_idx').on(table.active),
  ],
)

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: text('id').primaryKey(),
    couponId: text('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    couponCode: text('coupon_code').notNull(),
    orderId: text('order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    customerId: text('customer_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    orderTotal: integer('order_total').notNull(), // paisa
    discountAmount: integer('discount_amount').notNull(), // paisa
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('coupon_redemptions_coupon_id_idx').on(table.couponId),
    index('coupon_redemptions_order_id_idx').on(table.orderId),
    index('coupon_redemptions_customer_id_idx').on(table.customerId),
    uniqueIndex('coupon_redemptions_coupon_order_uniq_idx')
      .on(table.couponId, table.orderId)
      .where(sql`order_id IS NOT NULL`),
  ],
)

export const complaints = pgTable(
  'complaints',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerName: text('customer_name').notNull(),
    orderId: text('order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved'
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('complaints_customer_id_idx').on(table.customerId),
    index('complaints_status_idx').on(table.status),
  ],
)

export const banners = pgTable(
  'banners',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    imageUrl: text('image_url').notNull(),
    href: text('href').notNull(),
    placement: text('placement').notNull().default('home'), // 'home' | 'drinks' | 'grocery'
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('banners_placement_idx').on(table.placement),
    index('banners_active_idx').on(table.active),
  ],
)

export const campaigns = pgTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    channel: text('channel').notNull(), // 'sms' | 'email' | 'push' | 'in-app'
    status: text('status').notNull().default('draft'), // 'draft' | 'scheduled' | 'sent'
    audience: text('audience').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('campaigns_status_idx').on(table.status),
    index('campaigns_scheduled_at_idx').on(table.scheduledAt),
  ],
)

export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    productName: text('product_name').notNull(),
    customerName: text('customer_name').notNull(),
    rating: integer('rating').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'published' | 'hidden'
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('reviews_status_idx').on(table.status),
    index('reviews_rating_idx').on(table.rating),
  ],
)

export const shippingZones = pgTable(
  'shipping_zones',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    areas: text('areas').notNull(),
    deliveryCharge: integer('delivery_charge').notNull(), // paisa
    etaMinutes: integer('eta_minutes').notNull().default(45),
    active: boolean('active').notNull().default(true),
    courier: text('courier').notNull().default('in-house'), // 'in-house' | 'ncm' | 'pathao' | 'none'
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('shipping_zones_active_idx').on(table.active)],
)

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(user, {
      fields: [userPermissions.userId],
      references: [user.id],
    }),
  }),
)

export const complaintsRelations = relations(complaints, ({ one }) => ({
  customer: one(user, {
    fields: [complaints.customerId],
    references: [user.id],
  }),
  order: one(orders, {
    fields: [complaints.orderId],
    references: [orders.id],
  }),
}))

export const couponsRelations = relations(coupons, ({ many }) => ({
  redemptions: many(couponRedemptions),
}))

export const couponRedemptionsRelations = relations(
  couponRedemptions,
  ({ one }) => ({
    coupon: one(coupons, {
      fields: [couponRedemptions.couponId],
      references: [coupons.id],
    }),
    order: one(orders, {
      fields: [couponRedemptions.orderId],
      references: [orders.id],
    }),
    customer: one(user, {
      fields: [couponRedemptions.customerId],
      references: [user.id],
    }),
  }),
)

export const offers = pgTable(
  'offers',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    type: text('type').notNull().default('percent'), // 'bogo' | 'percent' | 'fixed' | 'free_delivery' | 'bundle'
    scope: text('scope').notNull().default('all'), // 'all' | 'category' | 'brand' | 'product' | 'variant'
    scopeId: text('scope_id'),
    discountValue: integer('discount_value').notNull().default(0), // percentage or paisa
    minOrderAmount: integer('min_order_amount').notNull().default(0), // paisa
    bannerUrl: text('banner_url'),
    heading: text('heading'),
    description: text('description'),
    priority: integer('priority').notNull().default(0),
    stackable: boolean('stackable').notNull().default(false),
    active: boolean('active').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('offers_slug_idx').on(table.slug),
    index('offers_active_idx').on(table.active),
    index('offers_type_idx').on(table.type),
    index('offers_scope_idx').on(table.scope, table.scopeId),
  ],
)

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default('Home'), // 'Home' | 'Work' | 'Other'
    address: text('address').notNull(),
    city: text('city').notNull().default('Butwal'),
    landmark: text('landmark'),
    lat: numeric('lat', { precision: 10, scale: 7 }),
    lng: numeric('lng', { precision: 10, scale: 7 }),
    isDefault: boolean('is_default').notNull().default(false),
    contactPhone: text('contact_phone'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('customer_addresses_customer_id_idx').on(table.customerId),
    index('customer_addresses_is_default_idx').on(table.isDefault),
  ],
)

export const customerAddressesRelations = relations(
  customerAddresses,
  ({ one }) => ({
    customer: one(user, {
      fields: [customerAddresses.customerId],
      references: [user.id],
    }),
  }),
)


export const recycleBin = pgTable(
  'recycle_bin',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    data: jsonb('data').notNull(),
    deletedBy: text('deleted_by').notNull().default('Admin'),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('recycle_bin_entity_type_idx').on(table.entityType),
    index('recycle_bin_expires_at_idx').on(table.expiresAt),
    index('recycle_bin_deleted_at_idx').on(table.deletedAt),
  ],
)
