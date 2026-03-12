import { z } from 'zod'

const quoteItemSchema = z.object({
  item_type: z.enum(['product', 'service', 'custom']).default('product'),
  product_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  item_name: z.string().min(1),
  item_description: z.string().optional(),
  item_sku: z.string().optional(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  discount: z.number().min(0).optional().default(0),
  tax_rate: z.number().min(0).optional(),
  group_name: z.string().optional(),
  is_optional: z.boolean().optional().default(false),
  sat_code: z.string().optional(),
  sat_unit: z.string().optional(),
  notes: z.string().optional(),
})

export const createQuoteSchema = z.object({
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  customer_rfc: z.string().optional(),
  customer_address: z.string().optional(),
  valid_days: z.number().int().min(1).optional().default(30),
  conditions: z.string().optional(),
  notes: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  sales_person_name: z.string().optional(),
  is_template: z.boolean().optional().default(false),
  template_name: z.string().optional(),
  follow_up_date: z.string().optional(),
  follow_up_notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1),
})

export const updateQuoteSchema = z.object({
  customer_id: z.string().uuid().optional(),
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_rfc: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable(),
  valid_days: z.number().int().min(1).optional(),
  conditions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms_and_conditions: z.string().optional().nullable(),
  sales_person_name: z.string().optional().nullable(),
  is_template: z.boolean().optional(),
  template_name: z.string().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  follow_up_notes: z.string().optional().nullable(),
  items: z.array(quoteItemSchema).min(1).optional(),
})

export const convertQuoteSchema = z.object({
  target: z.enum(['ticket', 'remission']),
  payment_type: z.string().optional(),
})

export const addActivitySchema = z.object({
  activity_type: z.enum(['follow_up', 'note', 'call', 'meeting']),
  description: z.string().min(1),
})

export const rejectQuoteSchema = z.object({
  reason: z.string().min(1),
})

export const cancelQuoteSchema = z.object({
  reason: z.string().min(1),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
export type ConvertQuoteInput = z.infer<typeof convertQuoteSchema>
export type AddActivityInput = z.infer<typeof addActivitySchema>
