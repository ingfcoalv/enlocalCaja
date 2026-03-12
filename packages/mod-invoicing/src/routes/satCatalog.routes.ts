import { Router } from 'express'
import { requirePermission } from '@enlocal/core-server'
import { sql } from 'drizzle-orm'

const router = Router()

// GET /tax-regimes — Regímenes fiscales
router.get(
  '/tax-regimes',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const personType = req.query.person_type as string | undefined
      let query = 'SELECT code, description, persona_moral, persona_fisica FROM sat_tax_regimes WHERE active = true'
      if (personType === 'moral') query += ' AND persona_moral = true'
      if (personType === 'fisica') query += ' AND persona_fisica = true'
      query += ' ORDER BY code'
      const result = await db.execute(sql.raw(query))
      res.json({ data: result.rows || result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /cfdi-uses — Usos de CFDI
router.get(
  '/cfdi-uses',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const personType = req.query.person_type as string | undefined
      let query = 'SELECT code, description, persona_moral, persona_fisica FROM sat_cfdi_uses WHERE active = true'
      if (personType === 'moral') query += ' AND persona_moral = true'
      if (personType === 'fisica') query += ' AND persona_fisica = true'
      query += ' ORDER BY code'
      const result = await db.execute(sql.raw(query))
      res.json({ data: result.rows || result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /payment-forms — Formas de pago
router.get(
  '/payment-forms',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const result = await db.execute(sql`SELECT code, description FROM sat_payment_forms WHERE active = true ORDER BY code`)
      res.json({ data: result.rows || result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /product-codes — Claves de producto/servicio SAT (con búsqueda)
router.get(
  '/product-codes',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const q = req.query.q as string | undefined
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

      if (q && q.length >= 2) {
        const search = `%${q}%`
        const result = await db.execute(
          sql`SELECT code, description FROM sat_product_codes WHERE active = true AND (code ILIKE ${search} OR description ILIKE ${search}) ORDER BY code LIMIT ${limit}`
        )
        res.json({ data: result.rows || result })
      } else {
        const result = await db.execute(
          sql`SELECT code, description FROM sat_product_codes WHERE active = true ORDER BY code LIMIT ${limit}`
        )
        res.json({ data: result.rows || result })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /unit-codes — Claves de unidad SAT (con búsqueda)
router.get(
  '/unit-codes',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const q = req.query.q as string | undefined
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

      if (q && q.length >= 1) {
        const search = `%${q}%`
        const result = await db.execute(
          sql`SELECT code, name, description FROM sat_unit_codes WHERE active = true AND (code ILIKE ${search} OR name ILIKE ${search}) ORDER BY code LIMIT ${limit}`
        )
        res.json({ data: result.rows || result })
      } else {
        const result = await db.execute(
          sql`SELECT code, name, description FROM sat_unit_codes WHERE active = true ORDER BY code LIMIT ${limit}`
        )
        res.json({ data: result.rows || result })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /currencies — Monedas SAT
router.get(
  '/currencies',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const result = await db.execute(sql`SELECT code, description, decimals FROM sat_currencies WHERE active = true ORDER BY code`)
      res.json({ data: result.rows || result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /relationship-types — Tipos de relación entre CFDIs
router.get(
  '/relationship-types',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const result = await db.execute(sql`SELECT code, description FROM sat_relationship_types WHERE active = true ORDER BY code`)
      res.json({ data: result.rows || result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// GET /countries — Países SAT (para Carta Porte)
router.get(
  '/countries',
  requirePermission('invoices.read') as any,
  async (req, res) => {
    try {
      const db = req.app.get('db')
      const result = await db.execute(sql`SELECT code, description FROM sat_countries WHERE active = true ORDER BY description`)
      res.json({ data: result.rows || result })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

export default router
