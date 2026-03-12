import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { settings, quotes } from '@enlocal/core-db'
import { eq, sql } from 'drizzle-orm'
import { updateQuoteDefaultsSchema } from '../validators/emailConfig.validator'

const router = Router()

// GET /quote-folio — get quote folio config
router.get(
  '/quote-folio',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')

      const [maxRow] = await db
        .select({ maxFolio: sql<number>`coalesce(max(${quotes.folio}), 0)` })
        .from(quotes)

      const [configRow] = await db.select().from(settings)
        .where(eq(settings.key, 'quote_starting_folio'))

      res.json({
        series: 'COT',
        currentFolio: maxRow?.maxFolio ?? 0,
        startingFolio: configRow ? parseInt(configRow.value) : 1,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching folio config' })
    }
  }
)

// PUT /quote-folio — update quote starting folio
router.put(
  '/quote-folio',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { startingFolio } = req.body
      if (!startingFolio || startingFolio < 1) {
        return res.status(400).json({ error: 'startingFolio must be >= 1' })
      }

      const [existing] = await db.select().from(settings)
        .where(eq(settings.key, 'quote_starting_folio'))

      if (existing) {
        await db.update(settings).set({ value: String(startingFolio) })
          .where(eq(settings.key, 'quote_starting_folio'))
      } else {
        await db.insert(settings).values({ key: 'quote_starting_folio', value: String(startingFolio) })
      }

      res.json({ success: true })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating folio config' })
    }
  }
)

// GET /quote-defaults — get quote defaults (valid days, templates, T&C)
router.get(
  '/quote-defaults',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const keys = ['quote_valid_days', 'quote_email_subject_template', 'quote_email_body_template', 'quote_terms_and_conditions']
      const rows = await db.select().from(settings)
        .where(eq(settings.key, keys[0]))

      // Get all settings at once
      const allRows = await db.select().from(settings)
      const cfg: Record<string, string> = {}
      for (const row of allRows) {
        if (keys.includes(row.key)) cfg[row.key] = row.value
      }

      res.json({
        validDays: parseInt(cfg.quote_valid_days || '30'),
        emailSubjectTemplate: cfg.quote_email_subject_template || 'Cotizacion {{folio}} - {{business_name}}',
        emailBodyTemplate: cfg.quote_email_body_template || '<p>Estimado(a) {{customer_name}},</p><p>Adjunto encontrara nuestra cotizacion {{folio}} por un total de {{total}}.</p><p>Esta cotizacion tiene vigencia hasta el {{valid_until}}.</p><p>Quedamos a sus ordenes.</p><p>Saludos,<br>{{sales_person}}</p>',
        termsAndConditions: cfg.quote_terms_and_conditions || '',
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching quote defaults' })
    }
  }
)

// PUT /quote-defaults — update quote defaults
router.put(
  '/quote-defaults',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateQuoteDefaultsSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const pairs: [string, string][] = []
      if (parsed.data.quote_valid_days !== undefined) pairs.push(['quote_valid_days', String(parsed.data.quote_valid_days)])
      if (parsed.data.quote_email_subject_template !== undefined) pairs.push(['quote_email_subject_template', parsed.data.quote_email_subject_template])
      if (parsed.data.quote_email_body_template !== undefined) pairs.push(['quote_email_body_template', parsed.data.quote_email_body_template])
      if (parsed.data.quote_terms_and_conditions !== undefined) pairs.push(['quote_terms_and_conditions', parsed.data.quote_terms_and_conditions])

      for (const [key, value] of pairs) {
        const [existing] = await db.select().from(settings).where(eq(settings.key, key))
        if (existing) {
          await db.update(settings).set({ value }).where(eq(settings.key, key))
        } else {
          await db.insert(settings).values({ key, value })
        }
      }

      res.json({ success: true })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating quote defaults' })
    }
  }
)

export default router
