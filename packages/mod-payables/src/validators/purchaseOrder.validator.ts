import { z } from 'zod'

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_cost: z.number().positive(),
  discount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
})

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  payment_terms: z.enum(['cash', 'credit']).optional().default('credit'),
  expected_date: z.string().optional(),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
  internal_notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
})

export const updatePurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid().optional(),
  payment_terms: z.enum(['cash', 'credit']).optional(),
  expected_date: z.string().optional().nullable(),
  delivery_address: z.string().optional().nullable(),
  delivery_notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1).optional(),
})

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().min(1),
})

export const closePurchaseOrderSchema = z.object({
  reason: z.string().min(1),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>
export type ClosePurchaseOrderInput = z.infer<typeof closePurchaseOrderSchema>
