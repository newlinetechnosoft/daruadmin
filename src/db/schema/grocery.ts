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

export const groceryCategories = pgTable(
  'grocery_categories',
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
  (table) => [index('grocery_categories_slug_idx').on(table.slug)],
)

export const groceryProducts = pgTable(
  'grocery_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => groceryCategories.id, { onDelete: 'restrict' }),
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
    index('grocery_products_slug_idx').on(table.slug),
    index('grocery_products_category_idx').on(table.categoryId),
  ],
)

export const groceryVariants = pgTable(
  'grocery_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => groceryProducts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Pack of 1", "500 g", "1 kg"
    unit: text('unit').notNull(), // e.g. "g", "kg", "pcs", "pack"
    quantity: numeric('quantity', { precision: 8, scale: 2 }).notNull(),
    sku: text('sku').notNull().unique(),
    price: integer('price').notNull(), // in paisa
    mrp: integer('mrp'), // in paisa
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
    index('grocery_variants_product_idx').on(table.productId),
    index('grocery_variants_sku_idx').on(table.sku),
  ],
)

export const groceryImages = pgTable(
  'grocery_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => groceryProducts.id, { onDelete: 'cascade' }),
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
  (table) => [index('grocery_images_product_idx').on(table.productId)],
)

export const groceryCategoriesRelations = relations(
  groceryCategories,
  ({ many }) => ({
    products: many(groceryProducts),
  }),
)

export const groceryProductsRelations = relations(
  groceryProducts,
  ({ one, many }) => ({
    category: one(groceryCategories, {
      fields: [groceryProducts.categoryId],
      references: [groceryCategories.id],
    }),
    variants: many(groceryVariants),
    images: many(groceryImages),
  }),
)

export const groceryVariantsRelations = relations(
  groceryVariants,
  ({ one }) => ({
    product: one(groceryProducts, {
      fields: [groceryVariants.productId],
      references: [groceryProducts.id],
    }),
  }),
)

export const groceryImagesRelations = relations(groceryImages, ({ one }) => ({
  product: one(groceryProducts, {
    fields: [groceryImages.productId],
    references: [groceryProducts.id],
  }),
}))
