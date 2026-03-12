import { z } from 'zod'

export const collectPaymentSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive()),
  payment_method: z.enum(['cash', 'debit_card', 'credit_card', 'spei', 'check', 'transfer']).optional(),
  paymentMethod: z.enum(['cash', 'debit_card', 'credit_card', 'spei', 'check', 'transfer']).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  emit_complement: z.boolean().optional().default(false),
}).transform((data) => ({
  amount: data.amount,
  payment_method: data.payment_method || data.paymentMethod || 'cash',
  reference: data.reference || undefined,
  notes: data.notes || undefined,
  emit_complement: data.emit_complement,
}))

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>
