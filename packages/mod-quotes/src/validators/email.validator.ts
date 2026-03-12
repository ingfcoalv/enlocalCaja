import { z } from 'zod'

export const sendQuoteEmailSchema = z.object({
  to: z.string().email(),
  cc: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  attach_pdf: z.boolean().optional().default(true),
})

export type SendQuoteEmailInput = z.infer<typeof sendQuoteEmailSchema>
