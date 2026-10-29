import { z } from 'zod'

export const listLiquorSchema = z.object({
  categorySlug: z.string().optional(),
  brandSlug: z.string().optional(),
  query: z.string().optional(),
  isFeatured: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
})

export const listGrocerySchema = z.object({
  categorySlug: z.string().optional(),
  query: z.string().optional(),
  isFeatured: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
})

export const searchCatalogSchema = z.object({
  query: z.string().min(1).max(100),
})

export const upsertLiquorProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  images: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        url: z.string(),
        alt: z.string().optional().nullable(),
        sortOrder: z.number().int().default(0),
        isPrimary: z.boolean().default(false),
      }),
    )
    .optional(),
  isFeatured: z.boolean().default(false),
  customBadge: z.string().optional().nullable(),
  customDiscountLabel: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  dealerIds: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        volumeMl: z.number().int().positive(),
        sku: z.string().min(2),
        price: z.number().int().positive(), // in paisa
        mrp: z.number().int().positive().optional().nullable(),
        abv: z.string().optional().nullable(),
        stock: z.number().int().nonnegative().default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .min(1),
})

export const upsertGroceryProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  images: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        url: z.string(),
        alt: z.string().optional().nullable(),
        sortOrder: z.number().int().default(0),
        isPrimary: z.boolean().default(false),
      }),
    )
    .optional(),
  isFeatured: z.boolean().default(false),
  customBadge: z.string().optional().nullable(),
  customDiscountLabel: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  dealerIds: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        unit: z.string().min(1),
        quantity: z.string().default('1.00'),
        sku: z.string().min(2),
        price: z.number().int().positive(), // in paisa
        mrp: z.number().int().positive().optional().nullable(),
        stock: z.number().int().nonnegative().default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .min(1),
})

export const toggleProductStatusSchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']),
  id: z.string().uuid(),
  field: z.enum(['isActive', 'isFeatured']),
  value: z.boolean(),
})

export const upsertCategorySchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']),
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  showOnLandingPage: z.boolean().default(false),
})

export const toggleCategoryStatusSchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']),
  id: z.string().uuid(),
  field: z.enum(['isActive', 'showOnLandingPage']),
  value: z.boolean(),
})

export const upsertBrandSchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']).default('liquor'),
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  origin: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const deleteItemSchema = z.object({
  catalogType: z.enum([
    'liquor',
    'grocery',
    'liquor-category',
    'grocery-category',
    'liquor-brand',
    'grocery-brand',
    'dealer',
  ]),
  id: z.string(),
})

export const deleteProductImageSchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']),
  imageId: z.string().uuid(),
  imageUrl: z.string().optional(),
})

export const createImageUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string(),
  prefix: z.string().default('products'),
})

export type ListLiquorInput = z.infer<typeof listLiquorSchema>
export type ListGroceryInput = z.infer<typeof listGrocerySchema>
export type SearchCatalogInput = z.infer<typeof searchCatalogSchema>
export type UpsertLiquorProductInput = z.infer<typeof upsertLiquorProductSchema>
export type UpsertGroceryProductInput = z.infer<
  typeof upsertGroceryProductSchema
>
export type ToggleProductStatusInput = z.infer<typeof toggleProductStatusSchema>
export type ToggleCategoryStatusInput = z.infer<
  typeof toggleCategoryStatusSchema
>
export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>
export type UpsertBrandInput = z.infer<typeof upsertBrandSchema>
export type DeleteItemInput = z.infer<typeof deleteItemSchema>
export type DeleteProductImageInput = z.infer<typeof deleteProductImageSchema>
export type CreateImageUploadInput = z.infer<typeof createImageUploadSchema>
