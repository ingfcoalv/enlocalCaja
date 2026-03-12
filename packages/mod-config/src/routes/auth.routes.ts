import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { authMiddleware } from '@enlocal/core-server'
import { loginWithPin, refreshToken, getStaffList } from '../services/auth.service'
import { loginSchema } from '../validators'

const router = Router()

// 3.6 — Simple rate limiter for login attempts (5 per minute per IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= MAX_ATTEMPTS
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip)
  }
}, 300_000)

/**
 * POST /login
 * Public - Authenticate with PIN and optional user_id.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos. Espera un minuto.' })
      return
    }

    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
      return
    }

    const { pin, user_id } = parsed.data
    const db = req.app.get('db')
    const result = await loginWithPin(db, pin, user_id)

    res.json(result)
  } catch (err: any) {
    // Return generic error to prevent user enumeration
    if (err.message === 'USER_NOT_FOUND' || err.message === 'INVALID_PIN') {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Credenciales incorrectas' })
      return
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * POST /logout
 * Placeholder - client-side token removal.
 */
router.post('/logout', authMiddleware as any, (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Sesión cerrada' })
})

/**
 * POST /refresh
 * Authenticated - Renew JWT token.
 */
router.post('/refresh', authMiddleware as any, (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    if (!authReq.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' })
      return
    }

    const result = refreshToken(authReq.user)
    res.json(result)
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  }
})

/**
 * GET /staff-list
 * Public - Return active users for login screen (no sensitive data).
 */
router.get('/staff-list', async (req: Request, res: Response) => {
  try {
    // Try drizzle first, fallback to raw SQL if bundling breaks instanceof checks
    const db = req.app.get('db')
    let staffList: any[]
    try {
      staffList = await getStaffList(db)
    } catch {
      const pool = req.app.get('pool')
      const result = await pool.query(
        `SELECT id, name, color, photo, role FROM users WHERE active = true ORDER BY name`
      )
      staffList = result.rows
    }
    res.json(staffList)
  } catch (err: any) {
    console.error('[staff-list] Error:', err.message, err.stack)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || 'Error interno del servidor' })
  }
})

/**
 * POST /authorize-pin
 * Authenticated - Validate a PIN for admin authorization (e.g., credit exceptions, cancellations).
 * Does not generate a new JWT — just verifies PIN and checks role.
 */
router.post('/authorize-pin', authMiddleware as any, async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db')
    const { pin, required_roles } = req.body
    if (!pin || typeof pin !== 'string') {
      res.status(400).json({ authorized: false, reason: 'PIN requerido' })
      return
    }

    const allowedRoles = required_roles || ['owner', 'admin', 'manager']

    // Reuse loginWithPin to find the user with this PIN
    const result = await loginWithPin(db, pin)
    const authorizer = result.user

    if (!allowedRoles.includes(authorizer.role)) {
      res.status(403).json({
        authorized: false,
        reason: `El usuario ${authorizer.name} no tiene rol suficiente (${authorizer.role}). Se requiere: ${allowedRoles.join(', ')}`,
      })
      return
    }

    res.json({
      authorized: true,
      authorizer: { id: authorizer.id, name: authorizer.name, role: authorizer.role },
    })
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND' || err.message === 'INVALID_PIN') {
      res.status(401).json({ authorized: false, reason: 'PIN incorrecto' })
      return
    }
    res.status(500).json({ authorized: false, reason: 'Error interno del servidor' })
  }
})

/**
 * GET /me
 * Authenticated - Return current user info from JWT.
 */
router.get('/me', authMiddleware as any, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest
  if (!authReq.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' })
    return
  }
  res.json(authReq.user)
})

export default router
