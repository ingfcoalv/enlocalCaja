import { z } from 'zod'

const receiveItemSchema = z.object({
  order_item_id: z.string().uuid(),
  quantity_received: z.number().positive(),
  quantity_rejected: z.number().min(0).optional().default(0),
  condition: z.enum(['good', 'damaged', 'partial']).optional().default('good'),
  condition_notes: z.string().optional(),
})

export const receiveItemsSchema = z.object({
  items: z.array(receiveItemSchema).min(1),
  notes: z.string().nullable().optional(),
})

export type ReceiveItemsInput = z.infer<typeof receiveItemsSchema>
