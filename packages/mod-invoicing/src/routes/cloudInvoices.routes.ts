import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { buildCloudHeaders } from '@enlocal/core-license'

const CLOUD_API_URL =
  process.env.CLOUD_API_URL || 'https://api.todoenlocal.com'

const router = Router()

// GET /api/invoices/cloud — proxy to V2 invoicing/invoices with pagination
router.get(
  '/cloud',
  requirePermission('invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { skip = '0', limit = '20', status_filter } = req.query

      const url = new URL(`${CLOUD_API_URL}/api/v2/invoicing/invoices`)
      url.searchParams.set('skip', String(skip))
      url.searchParams.set('limit', String(limit))
      if (status_filter) {
        url.searchParams.set('status_filter', String(status_filter))
      }

      let headers: Record<string, string>
      try {
        headers = { ...buildCloudHeaders() }
      } catch {
        return res.status(401).json({ error: 'No terminal token available' })
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return res.status(response.status).json({
          error: `Cloud API error: ${response.status}`,
          detail: body,
        })
      }

      const data = await response.json()
      res.json(data)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching cloud invoices' })
    }
  }
)

export default router
