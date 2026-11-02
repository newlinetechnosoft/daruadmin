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

export const foodCategories = pgTable(
  'food_categories',
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
  (table) => [index('food_categories_slug_idx').on(table.slug)],
)

export const foodBrands = pgTable(
  'food_brands',
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
  (table) => [index('food_brands_slug_idx').on(table.slug)],
)

export const foodProducts = pgTable(
  'food_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => foodCategories.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => foodBrands.id, {
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
    index('food_products_slug_idx').on(table.slug),
    index('food_products_category_idx').on(table.categoryId),
    index('food_products_brand_idx').on(table.brandId),
  ],
)

export const foodVariants = pgTable(
  'food_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => foodProducts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Pack of 1", "500 g", "1 kg"
    unit: text('unit').notNull(), // e.g. "g", "kg", "pcs", "pack"
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
    index('food_variants_product_idx').on(table.productId),
    index('food_variants_sku_idx').on(table.sku),
  ],
)

export const foodImages = pgTable(
  'food_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => foodProducts.id, { onDelete: 'cascade' }),
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
  (table) => [index('food_images_product_idx').on(table.productId)],
)

export const foodCategoriesRelations = relations(
  foodCategories,
  ({ many }) => ({
    products: many(foodProducts),
  }),
)

export const foodProductsRelations = relations(
  foodProducts,
  ({ one, many }) => ({
    category: one(foodCategories, {
      fields: [foodProducts.categoryId],
      references: [foodCategories.id],
    }),
    brand: one(foodBrands, {
      fields: [foodProducts.brandId],
      references: [foodBrands.id],
    }),
    variants: many(foodVariants),
    images: many(foodImages),
  }),
)

export const foodBrandsRelations = relations(foodBrands, ({ many }) => ({
  products: many(foodProducts),
}))

export const foodVariantsRelations = relations(
  foodVariants,
  ({ one }) => ({
    product: one(foodProducts, {
      fields: [foodVariants.productId],
      references: [foodProducts.id],
    }),
  }),
)

export const foodImagesRelations = relations(foodImages, ({ one }) => ({
  product: one(foodProducts, {
    fields: [foodImages.productId],
    references: [foodProducts.id],
  }),
}))
