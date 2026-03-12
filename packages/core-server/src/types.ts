import type { Request } from 'express'

export interface ServerConfig {
  db: any
  enabledModules?: string[]
  jwtSecret?: string
}

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
