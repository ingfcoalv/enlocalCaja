import { Router } from 'express'
import type { Request, Response } from 'express'
import { requirePermission } from '@enlocal/core-server'
import { settings } from '@enlocal/core-db'
import { eq } from 'drizzle-orm'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const router = Router()

/**
 * Multer configuration: memory storage, 10MB limit, image-only filter.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
    ]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos de imagen (jpeg, png, gif, webp, bmp, tiff)'))
    }
  },
})

/**
 * POST /logo
 * Upload and compress a business logo.
 */
router.post(
  '/logo',
  requirePermission('settings.update') as any,
  upload.single('logo') as any,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'NO_FILE', message: 'No se proporcionó ningún archivo' })
        return
      }

      const db = req.app.get('db')
      const userData = req.app.get('userData') || process.env.ENLOCAL_DATA || '/tmp/enlocal'
      const brandingDir = path.join(userData, 'branding')

      // Ensure branding directory exists
      fs.mkdirSync(brandingDir, { recursive: true })

      const filePath = path.join(brandingDir, 'logo.webp')
      const originalSize = req.file.size

      // Compress to WebP at 90% quality, max 800px width maintaining aspect ratio
      const compressedBuffer = await sharp(req.file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer()

      fs.writeFileSync(filePath, compressedBuffer)

      // Save path in settings table
      await db
        .insert(settings)
        .values({ key: 'business_logo_path', value: filePath })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: filePath, updatedAt: new Date() },
        })

      res.json({
        success: true,
        path: filePath,
        size: originalSize,
        compressedSize: compressedBuffer.length,
      })
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
    }
  }
)

/**
 * GET /logo
 * Serve the business logo file (public, needed for PDFs).
 */
router.get('/logo', async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')

    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'business_logo_path'))

    if (!row || !row.value) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No se ha configurado un logo' })
      return
    }

    const logoPath = row.value as string

    if (!fs.existsSync(logoPath)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'El archivo del logo no existe' })
      return
    }

    res.setHeader('Content-Type', 'image/webp')
    res.sendFile(logoPath)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * DELETE /logo
 * Delete the business logo.
 */
router.delete(
  '/logo',
  requirePermission('settings.update') as any,
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db')

      const [row] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'business_logo_path'))

      if (row && row.value) {
        const logoPath = row.value as string
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath)
        }
      }

      await db.delete(settings).where(eq(settings.key, 'business_logo_path'))

      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
    }
  }
)

export default router
