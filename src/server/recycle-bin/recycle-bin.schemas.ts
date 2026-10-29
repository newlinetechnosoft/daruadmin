import { z } from 'zod'

export const restoreRecycleBinSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
})

export const permanentDeleteRecycleBinSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
})

export const emptyRecycleBinSchema = z.object({}).optional()

export type RestoreRecycleBinInput = z.infer<typeof restoreRecycleBinSchema>
export type PermanentDeleteRecycleBinInput = z.infer<typeof permanentDeleteRecycleBinSchema>
export type EmptyRecycleBinInput = z.infer<typeof emptyRecycleBinSchema>
