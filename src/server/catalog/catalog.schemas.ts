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

export type ListLiquorInput = z.infer<typeof listLiquorSchema>
export type ListGroceryInput = z.infer<typeof listGrocerySchema>
export type SearchCatalogInput = z.infer<typeof searchCatalogSchema>
