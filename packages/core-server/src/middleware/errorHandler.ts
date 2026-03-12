import type { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Error interno del servidor'
  const code = err.code || 'INTERNAL_ERROR'

  if (statusCode === 500) {
    console.error('[enlocal-server] Error:', err)
  }

  res.status(statusCode).json({
    error: code,
    message,
    statusCode,
  })
}
