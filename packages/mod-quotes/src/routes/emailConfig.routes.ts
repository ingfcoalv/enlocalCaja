import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { getMailerConfig, saveMailerConfig, testEmailConfig } from '../services/mailer.service'
import { updateEmailConfigSchema, testEmailSchema } from '../validators/emailConfig.validator'

const router = Router()

// GET /email — get email config (without password)
router.get(
  '/email',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const config = await getMailerConfig(db)
      res.json(config)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching email config' })
    }
  }
)

// PUT /email — update email config
router.put(
  '/email',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateEmailConfigSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      await saveMailerConfig(db, parsed.data)
      const config = await getMailerConfig(db)
      res.json(config)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating email config' })
    }
  }
)

// POST /email/test — send test email
router.post(
  '/email/test',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = testEmailSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      await testEmailConfig(db, parsed.data.to)
      res.json({ success: true, message: 'Email de prueba enviado exitosamente' })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error sending test email' })
    }
  }
)

export default router
