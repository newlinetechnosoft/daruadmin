import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const ddcCategories = pgTable(
  'ddc_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    showOnLandingPage: boolean('show_on_landing_page').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('ddc_categories_slug_idx').on(table.slug)],
)

export const ddcBrands = pgTable(
  'ddc_brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    origin: text('origin'),
    description: text('description'),
    logoUrl: text('logo_url'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('ddc_brands_slug_idx').on(table.slug)],
)

export const ddcProducts = pgTable(
  'ddc_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => ddcCategories.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => ddcBrands.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    isFeatured: boolean('is_featured').default(false).notNull(),
    customBadge: text('custom_badge'),
    customDiscountLabel: text('custom_discount_label'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('ddc_products_slug_idx').on(table.slug),
    index('ddc_products_category_idx').on(table.categoryId),
    index('ddc_products_brand_idx').on(table.brandId),
  ],
)

export const ddcVariants = pgTable(
  'ddc_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => ddcProducts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Pack of 1", "500 ml", "1 L"
    unit: text('unit').notNull(), // e.g. "g", "kg", "ml", "L", "pcs", "pack"
    quantity: numeric('quantity', { precision: 8, scale: 2 }).notNull(),
    sku: text('sku').notNull().unique(),
    price: integer('price').notNull(), // in paisa
    mrp: integer('mrp'), // in paisa
    compareAtPrice: integer('compare_at_price'), // in paisa
    stock: integer('stock').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('ddc_variants_product_idx').on(table.productId),
    index('ddc_variants_sku_idx').on(table.sku),
  ],
)

export const ddcImages = pgTable(
  'ddc_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => ddcProducts.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    alt: text('alt'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('ddc_images_product_idx').on(table.productId)],
)

export const ddcCategoriesRelations = relations(ddcCategories, ({ many }) => ({
  products: many(ddcProducts),
}))

export const ddcProductsRelations = relations(ddcProducts, ({ one, many }) => ({
  category: one(ddcCategories, {
    fields: [ddcProducts.categoryId],
    references: [ddcCategories.id],
  }),
  brand: one(ddcBrands, {
    fields: [ddcProducts.brandId],
    references: [ddcBrands.id],
  }),
  variants: many(ddcVariants),
  images: many(ddcImages),
}))

export const ddcBrandsRelations = relations(ddcBrands, ({ many }) => ({
  products: many(ddcProducts),
}))

export const ddcVariantsRelations = relations(ddcVariants, ({ one }) => ({
  product: one(ddcProducts, {
    fields: [ddcVariants.productId],
    references: [ddcProducts.id],
  }),
}))

export const ddcImagesRelations = relations(ddcImages, ({ one }) => ({
  product: one(ddcProducts, {
    fields: [ddcImages.productId],
    references: [ddcProducts.id],
  }),
}))
