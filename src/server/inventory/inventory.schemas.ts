import { z } from 'zod'

export const assignedItemSchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']),
  productId: z.string().uuid(),
  costPrice: z.number().int().nonnegative().optional(),
  isAvailable: z.boolean().optional(),
})

export const upsertDealerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Dealer name must be at least 2 characters').max(200),
  pan: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  providesVatBill: z.boolean().default(false),
  tdsRate: z.union([z.string(), z.number()]).default('0'),
  creditLimit: z.number().int().nonnegative().default(0), // paisa
  paymentTermsDays: z.number().int().nonnegative().default(0),
  openingBalance: z.number().int().default(0), // paisa
  contact: z.string().min(5, 'Contact number is required').max(30),
  whatsappNumber: z.string().max(30).optional().nullable(),
  address: z.string().min(2, 'Address is required').max(300),
  city: z.string().default('Butwal'),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
  assignedItems: z.array(assignedItemSchema).optional(),
})

export type UpsertDealerInput = z.infer<typeof upsertDealerSchema>

export const deleteDealerSchema = z.object({
  id: z.string(),
})

export type DeleteDealerInput = z.infer<typeof deleteDealerSchema>

export const assignDealerItemsSchema = z.object({
  dealerId: z.string(),
  items: z.array(assignedItemSchema),
})

export type AssignDealerItemsInput = z.infer<typeof assignDealerItemsSchema>

export const assignItemDealersSchema = z.object({
  catalogType: z.enum(['liquor', 'grocery']),
  productId: z.string().uuid(),
  dealerIds: z.array(z.string()),
})

export type AssignItemDealersInput = z.infer<typeof assignItemDealersSchema>
