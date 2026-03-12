import { z } from 'zod'

export const updateCreditSchema = z.object({
  credit_enabled: z.boolean(),
  credit_limit: z.number().min(0),
  credit_days: z.number().int().min(0),
  payment_terms: z.string().optional(),
})

export type UpdateCreditInput = z.infer<typeof updateCreditSchema>
