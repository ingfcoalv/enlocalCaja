import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import * as quoteService from '../services/quote.service'

const router = Router()

// GET /pipeline — pipeline stats by status
router.get(
  '/pipeline',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.getPipeline(db)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching pipeline' })
    }
  }
)

// GET /conversion-rate — conversion rate stats
router.get(
  '/conversion-rate',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.getConversionRate(db)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching conversion rate' })
    }
  }
)

// GET /needs-followup — quotes needing follow-up
router.get(
  '/needs-followup',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.getNeedsFollowUp(db)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching follow-ups' })
    }
  }
)

// GET /expiring-soon — quotes expiring soon
router.get(
  '/expiring-soon',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 3
      const result = await quoteService.getExpiringSoon(db, days)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching expiring quotes' })
    }
  }
)

export default router
