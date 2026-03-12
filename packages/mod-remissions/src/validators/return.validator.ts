import { z } from 'zod'

const returnItemSchema = z.object({
  remission_item_id: z.string().uuid(),
  quantity_requested: z.number().positive(),
})

export const createReturnSchema = z.object({
  remission_note_id: z.string().uuid(),
  return_type: z.enum(['full', 'partial']),
  reason_category: z.enum(['defective', 'wrong_product', 'excess', 'client_cancelled', 'other']),
  reason: z.string().min(1),
  items: z.array(returnItemSchema).min(1),
})

const processReturnItemSchema = z.object({
  return_item_id: z.string().uuid(),
  quantity_accepted: z.number().min(0),
  quantity_rejected: z.number().min(0),
  item_status: z.enum(['accepted', 'rejected', 'partial']),
  product_condition: z.enum(['good', 'damaged', 'expired', 'opened']),
  condition_notes: z.string().optional(),
  reject_reason: z.string().optional(),
  restock: z.boolean(),
})

export const processReturnSchema = z.object({
  items: z.array(processReturnItemSchema).min(1),
  review_notes: z.string().optional(),
})

export const rejectReturnSchema = z.object({
  reason: z.string().min(1),
})

export type CreateReturnInput = z.infer<typeof createReturnSchema>
export type ProcessReturnInput = z.infer<typeof processReturnSchema>
export type RejectReturnInput = z.infer<typeof rejectReturnSchema>
