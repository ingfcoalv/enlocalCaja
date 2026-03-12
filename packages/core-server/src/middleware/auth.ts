import jwt from 'jsonwebtoken'
import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest, AuthenticatedUser } from '../types'

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de autenticación requerido' })
    return
  }

  const token = authHeader.slice(7)
  const secret = req.app.get('jwtSecret') as string

  try {
    const decoded = jwt.verify(token, secret) as AuthenticatedUser
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token inválido o expirado' })
  }
}
