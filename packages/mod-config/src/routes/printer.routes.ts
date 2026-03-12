import { Router } from 'express'
import type { Request, Response } from 'express'
import { requirePermission } from '@enlocal/core-server'
import { settings } from '@enlocal/core-db'
import { eq } from 'drizzle-orm'
import net from 'net'
import os from 'os'

const router = Router()
const PRINTERS_KEY = 'printers_config'

interface PrinterConfig {
  ip: string
  port: number
  name: string
  paperWidth: 58 | 80
  isDefault?: boolean
}

async function loadPrinters(db: any): Promise<PrinterConfig[]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, PRINTERS_KEY))
  if (!row || !row.value) return []
  try { return JSON.parse(row.value as string) } catch { return [] }
}

async function savePrinters(db: any, printers: PrinterConfig[]): Promise<void> {
  await db
    .insert(settings)
    .values({ key: PRINTERS_KEY, value: JSON.stringify(printers) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(printers), updatedAt: new Date() },
    })
}

/**
 * GET / — List all configured printers
 */
router.get('/', requirePermission('settings.read') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const printers = await loadPrinters(db)
    res.json(printers)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al cargar impresoras' })
  }
})

/**
 * POST / — Add or update a printer
 */
router.post('/', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const { ip, port, name, paperWidth, oldIp } = req.body

    if (!ip || !name) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'IP y nombre son requeridos' })
      return
    }

    const printers = await loadPrinters(db)

    if (oldIp) {
      // Editing existing printer
      const idx = printers.findIndex((p) => p.ip === oldIp)
      if (idx >= 0) {
        const wasDefault = printers[idx].isDefault
        printers[idx] = { ip, port: port || 9100, name, paperWidth: paperWidth || 80, isDefault: wasDefault }
      } else {
        printers.push({ ip, port: port || 9100, name, paperWidth: paperWidth || 80 })
      }
    } else {
      // Adding new printer
      if (printers.some((p) => p.ip === ip)) {
        res.status(400).json({ error: 'DUPLICATE', message: 'Ya existe una impresora con esa IP' })
        return
      }
      const isFirst = printers.length === 0
      printers.push({ ip, port: port || 9100, name, paperWidth: paperWidth || 80, isDefault: isFirst })
    }

    await savePrinters(db, printers)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al guardar impresora' })
  }
})

/**
 * POST /default — Set default printer
 */
router.post('/default', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const { ip } = req.body
    const printers = await loadPrinters(db)
    for (const p of printers) p.isDefault = p.ip === ip
    await savePrinters(db, printers)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al establecer impresora predeterminada' })
  }
})

/**
 * DELETE /:ip — Remove a printer
 */
router.delete('/:ip', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const ip = decodeURIComponent(req.params.ip)
    let printers = await loadPrinters(db)
    printers = printers.filter((p) => p.ip !== ip)
    // If we deleted the default, set first as default
    if (printers.length > 0 && !printers.some((p) => p.isDefault)) {
      printers[0].isDefault = true
    }
    await savePrinters(db, printers)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al eliminar impresora' })
  }
})

/**
 * GET /scan — Scan local network for devices on port 9100
 */
router.get('/scan', requirePermission('settings.update') as any, async (_req: Request, res: Response) => {
  try {
    // Get server's local IP to determine subnet
    const interfaces = os.networkInterfaces()
    let subnet = ''
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          // e.g. 192.168.1.5 -> 192.168.1
          const parts = addr.address.split('.')
          subnet = parts.slice(0, 3).join('.')
          break
        }
      }
      if (subnet) break
    }

    if (!subnet) {
      res.json([])
      return
    }

    // Scan range 1-254 on port 9100 with short timeout
    const results: { ip: string; port: number }[] = []
    const scanPromises: Promise<void>[] = []

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`
      scanPromises.push(
        new Promise<void>((resolve) => {
          const socket = new net.Socket()
          socket.setTimeout(300)
          socket.on('connect', () => {
            results.push({ ip, port: 9100 })
            socket.destroy()
            resolve()
          })
          socket.on('timeout', () => { socket.destroy(); resolve() })
          socket.on('error', () => { socket.destroy(); resolve() })
          socket.connect(9100, ip)
        })
      )
    }

    await Promise.all(scanPromises)
    results.sort((a, b) => {
      const aParts = a.ip.split('.').map(Number)
      const bParts = b.ip.split('.').map(Number)
      return aParts[3] - bParts[3]
    })

    res.json(results)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al escanear la red' })
  }
})

/**
 * POST /test — Send test ticket to a printer
 */
router.post('/test', requirePermission('settings.update') as any, async (req: Request, res: Response) => {
  try {
    const { ip, port = 9100, paperWidth = 80 } = req.body

    if (!ip) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'IP es requerida' })
      return
    }

    // ESC/POS commands
    const INIT = '\x1B\x40'
    const ALIGN_CENTER = '\x1B\x61\x01'
    const ALIGN_LEFT = '\x1B\x61\x00'
    const BOLD_ON = '\x1B\x45\x01'
    const BOLD_OFF = '\x1B\x45\x00'
    const CUT = '\x1D\x56\x00'
    const FEED = '\x0A'

    const cols = paperWidth === 58 ? 32 : 48
    const separator = '-'.repeat(cols)
    const now = new Date().toLocaleString('es-MX')

    const ticket = [
      INIT,
      ALIGN_CENTER,
      BOLD_ON,
      'TICKET DE PRUEBA', FEED,
      BOLD_OFF,
      'enLocal POS', FEED,
      separator, FEED,
      ALIGN_LEFT,
      `Fecha: ${now}`, FEED,
      `IP: ${ip}:${port}`, FEED,
      `Papel: ${paperWidth}mm (${cols} cols)`, FEED,
      separator, FEED,
      ALIGN_CENTER,
      'Impresora configurada', FEED,
      'correctamente', FEED,
      FEED, FEED, FEED,
      CUT,
    ].join('')

    const data = Buffer.from(ticket, 'binary')

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()
      socket.setTimeout(5000)
      socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout al conectar con la impresora')) })
      socket.on('error', (err) => { socket.destroy(); reject(err) })
      socket.connect(port, ip, () => {
        socket.write(data, () => {
          socket.destroy()
          resolve()
        })
      })
    })

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: 'PRINT_ERROR', message: err?.message || 'Error al enviar ticket de prueba' })
  }
})

export default router
