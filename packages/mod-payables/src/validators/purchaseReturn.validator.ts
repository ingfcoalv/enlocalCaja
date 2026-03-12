import { z } from 'zod'

const returnItemSchema = z.object({
  order_item_id: z.string().uuid(),
  quantity_returned: z.number().positive(),
  condition: z.string().optional(),
  condition_notes: z.string().optional(),
})

export const createPurchaseReturnSchema = z.object({
  purchase_order_id: z.string().uuid(),
  return_type: z.enum(['full', 'partial']),
  reason_category: z.enum(['defective', 'wrong_product', 'excess', 'damaged', 'other']),
  reason: z.string().min(1),
  items: z.array(returnItemSchema).min(1),
})

export const completePurchaseReturnSchema = z.object({
  notes: z.string().optional(),
})

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>
export type CompletePurchaseReturnInput = z.infer<typeof completePurchaseReturnSchema>
