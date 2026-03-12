import { z } from 'zod'

export const updateEmailConfigSchema = z.object({
  email_host: z.string().min(1),
  email_port: z.number().int().min(1).max(65535),
  email_secure: z.boolean().optional().default(true),
  email_user: z.string().min(1),
  email_password: z.string().optional(),
  email_from_name: z.string().optional(),
  email_from_address: z.string().email().optional(),
})

export const testEmailSchema = z.object({
  to: z.string().email(),
})

export const updateQuoteDefaultsSchema = z.object({
  quote_valid_days: z.number().int().min(1).optional(),
  quote_email_subject_template: z.string().optional(),
  quote_email_body_template: z.string().optional(),
  quote_terms_and_conditions: z.string().optional(),
})

export type UpdateEmailConfigInput = z.infer<typeof updateEmailConfigSchema>
export type TestEmailInput = z.infer<typeof testEmailSchema>
export type UpdateQuoteDefaultsInput = z.infer<typeof updateQuoteDefaultsSchema>
