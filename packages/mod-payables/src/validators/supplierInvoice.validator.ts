import { z } from 'zod'

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_cost: z.number().positive(),
  discount: z.number().min(0).optional().default(0),
  tax_rate: z.number().min(0).optional().default(0.16),
  product_id: z.string().uuid().optional(),
  sat_code: z.string().optional(),
  sat_unit: z.string().optional(),
})

export const createSupplierInvoiceSchema = z.object({
  supplier_id: z.string().uuid(),
  purchase_order_id: z.string().uuid().optional(),
  payable_id: z.string().uuid().optional(),
  invoice_number: z.string().min(1),
  invoice_uuid: z.string().optional(),
  type: z.enum(['I', 'E', 'P']).optional().default('I'),
  parent_invoice_id: z.string().uuid().optional(),
  complement_amount: z.number().positive().optional(),
  issue_date: z.string(),
  payment_method: z.string().optional(),
  payment_form: z.string().optional(),
  currency: z.string().optional().default('MXN'),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).optional().default([]),
})

export const updateSupplierInvoiceSchema = z.object({
  invoice_number: z.string().min(1).optional(),
  invoice_uuid: z.string().optional().nullable(),
  issue_date: z.string().optional(),
  payment_method: z.string().optional().nullable(),
  payment_form: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1).optional(),
})

export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>
export type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>
