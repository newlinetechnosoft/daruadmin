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

export const liquorCategories = pgTable(
  'liquor_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('liquor_categories_slug_idx').on(table.slug)],
)

export const liquorBrands = pgTable(
  'liquor_brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    origin: text('origin'), // e.g. "Nepal", "Scotland", "Japan"
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
  (table) => [index('liquor_brands_slug_idx').on(table.slug)],
)

export const liquorProducts = pgTable(
  'liquor_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => liquorCategories.id, { onDelete: 'restrict' }),
    brandId: uuid('brand_id').references(() => liquorBrands.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    isFeatured: boolean('is_featured').default(false).notNull(),
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
    index('liquor_products_slug_idx').on(table.slug),
    index('liquor_products_category_idx').on(table.categoryId),
    index('liquor_products_brand_idx').on(table.brandId),
  ],
)

export const liquorVariants = pgTable(
  'liquor_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => liquorProducts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "750 ml", "375 ml", "180 ml"
    volumeMl: integer('volume_ml').notNull(),
    sku: text('sku').notNull().unique(),
    price: integer('price').notNull(), // in paisa
    mrp: integer('mrp'), // in paisa
    abv: numeric('abv', { precision: 4, scale: 2 }), // alcohol by volume percentage
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
    index('liquor_variants_product_idx').on(table.productId),
    index('liquor_variants_sku_idx').on(table.sku),
  ],
)

export const liquorImages = pgTable(
  'liquor_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => liquorProducts.id, { onDelete: 'cascade' }),
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
  (table) => [index('liquor_images_product_idx').on(table.productId)],
)

export const liquorCategoriesRelations = relations(
  liquorCategories,
  ({ many }) => ({
    products: many(liquorProducts),
  }),
)

export const liquorBrandsRelations = relations(liquorBrands, ({ many }) => ({
  products: many(liquorProducts),
}))

export const liquorProductsRelations = relations(
  liquorProducts,
  ({ one, many }) => ({
    category: one(liquorCategories, {
      fields: [liquorProducts.categoryId],
      references: [liquorCategories.id],
    }),
    brand: one(liquorBrands, {
      fields: [liquorProducts.brandId],
      references: [liquorBrands.id],
    }),
    variants: many(liquorVariants),
    images: many(liquorImages),
  }),
)

export const liquorVariantsRelations = relations(liquorVariants, ({ one }) => ({
  product: one(liquorProducts, {
    fields: [liquorVariants.productId],
    references: [liquorProducts.id],
  }),
}))

export const liquorImagesRelations = relations(liquorImages, ({ one }) => ({
  product: one(liquorProducts, {
    fields: [liquorImages.productId],
    references: [liquorProducts.id],
  }),
}))
