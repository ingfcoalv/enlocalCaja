declare module '@enlocal/core-server' {
  import type { Request, Response, NextFunction } from 'express'

  export interface AuthenticatedUser {
    id: string
    name: string
    role: string
    permissions: string[]
    maxDiscountPercent?: number
  }

  export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser
  }

  export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void
  export function requirePermission(permission: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void
}
