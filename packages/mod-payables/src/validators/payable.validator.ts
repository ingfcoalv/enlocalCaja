import { z } from 'zod'

export const paySchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive()),
  payment_method: z.enum(['cash', 'debit_card', 'credit_card', 'spei', 'check', 'transfer']),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const batchPaySchema = z.object({
  payments: z.array(z.object({
    payable_id: z.string().uuid(),
    amount: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive()),
  })).min(1),
  payment_method: z.enum(['cash', 'debit_card', 'credit_card', 'spei', 'check', 'transfer']),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const updatePrioritySchema = z.object({
  priority: z.number().int().min(0).max(10),
})

export type PayInput = z.infer<typeof paySchema>
export type BatchPayInput = z.infer<typeof batchPaySchema>
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>
