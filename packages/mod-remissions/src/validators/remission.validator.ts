import { z } from 'zod'

const remissionItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
  discount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
})

export const createRemissionSchema = z.object({
  customer_id: z.string().uuid(),
  payment_type: z.enum(['cash', 'credit']),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
  internal_notes: z.string().optional(),
  items: z.array(remissionItemSchema).min(1),
})

export const updateRemissionSchema = z.object({
  customer_id: z.string().uuid().optional(),
  payment_type: z.enum(['cash', 'credit']).optional(),
  delivery_address: z.string().optional().nullable(),
  delivery_notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  items: z.array(remissionItemSchema).min(1).optional(),
})

export const cancelRemissionSchema = z.object({
  reason: z.string().min(1),
  authorized_pin: z.string().optional(),
})

const prepareItemSchema = z.object({
  remission_item_id: z.string().uuid(),
  quantity_prepared: z.number().positive(),
})

export const prepareRemissionSchema = z.object({
  items: z.array(prepareItemSchema).min(1),
})

const deliverItemSchema = z.object({
  remission_item_id: z.string().uuid(),
  quantity_delivered: z.number().positive(),
})

export const deliverRemissionSchema = z.object({
  received_by: z.string().min(1),
  received_id_doc: z.string().optional(),
  signature_url: z.string().optional(),
  delivery_notes: z.string().optional(),
  items: z.array(deliverItemSchema).min(1),
})

export type CreateRemissionInput = z.infer<typeof createRemissionSchema>
export type UpdateRemissionInput = z.infer<typeof updateRemissionSchema>
export type CancelRemissionInput = z.infer<typeof cancelRemissionSchema>
export type PrepareRemissionInput = z.infer<typeof prepareRemissionSchema>
export type DeliverRemissionInput = z.infer<typeof deliverRemissionSchema>
