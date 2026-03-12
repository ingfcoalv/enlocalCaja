import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import * as supplierInvoiceService from '../services/supplierInvoice.service'
import { createSupplierInvoiceSchema, updateSupplierInvoiceSchema } from '../validators/supplierInvoice.validator'
import { supplierInvoices } from '@enlocal/core-db'
import { eq, sql } from 'drizzle-orm'

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF'))
    }
  },
})

const router = Router()

// GET / — list supplier invoices
router.get(
  '/',
  requirePermission('supplier_invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await supplierInvoiceService.getAll(db, {
        supplier_id: req.query.supplier_id as string | undefined,
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        payment_method: req.query.payment_method as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing supplier invoices' })
    }
  }
)

// GET /:id/complements — list complements for a PPD invoice
router.get(
  '/:id/complements',
  requirePermission('supplier_invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await supplierInvoiceService.getComplements(db, req.params.id)
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching complements' })
    }
  }
)

// GET /:id — get supplier invoice detail
router.get(
  '/:id',
  requirePermission('supplier_invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await supplierInvoiceService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Factura de proveedor no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching supplier invoice' })
    }
  }
)

// POST / — create supplier invoice
router.post(
  '/',
  requirePermission('supplier_invoices.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createSupplierInvoiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await supplierInvoiceService.create(db, parsed.data, req.user?.id ?? 'system')
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating supplier invoice' })
    }
  }
)

// PUT /:id — update supplier invoice (pending only)
router.put(
  '/:id',
  requirePermission('supplier_invoices.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateSupplierInvoiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await supplierInvoiceService.update(db, req.params.id, parsed.data, req.user?.id ?? 'system')
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating supplier invoice' })
    }
  }
)

// POST /parse-xml — parse CFDI XML and return structured data
router.post(
  '/parse-xml',
  requirePermission('supplier_invoices.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const xmlContent = req.body.xml_content || req.body.xmlContent
      if (!xmlContent) return res.status(400).json({ error: 'Se requiere contenido XML' })
      const result = await supplierInvoiceService.parseXml(db, xmlContent)
      res.json({ data: result })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error al parsear XML' })
    }
  }
)

// POST /:id/upload-pdf — upload scanned PDF for a supplier invoice
router.post(
  '/:id/upload-pdf',
  requirePermission('supplier_invoices.update') as any,
  pdfUpload.single('pdf') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      if (!req.file) return res.status(400).json({ error: 'No se proporcionó ningún archivo PDF' })

      const [invoice] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, req.params.id))
      if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' })

      // Save PDF to disk
      const uploadsDir = path.join(process.cwd(), 'uploads', 'supplier-invoices')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const filename = `${req.params.id}.pdf`
      const filePath = path.join(uploadsDir, filename)
      fs.writeFileSync(filePath, req.file.buffer)

      // Store the path in notes or a dedicated field
      await db.update(supplierInvoices).set({
        notes: invoice.notes
          ? `${invoice.notes}\n[PDF adjunto: ${filename}]`
          : `[PDF adjunto: ${filename}]`,
        updatedAt: sql`now()`,
      }).where(eq(supplierInvoices.id, req.params.id))

      res.json({ success: true, filename, path: `/uploads/supplier-invoices/${filename}` })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al subir PDF' })
    }
  }
)

// GET /:id/pdf — download uploaded PDF for a supplier invoice
router.get(
  '/:id/pdf',
  requirePermission('supplier_invoices.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const filePath = path.join(process.cwd(), 'uploads', 'supplier-invoices', `${req.params.id}.pdf`)
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF no encontrado' })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="factura-${req.params.id}.pdf"`)
      res.send(fs.readFileSync(filePath))
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al descargar PDF' })
    }
  }
)

export default router
