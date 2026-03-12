import type { Request, Response, NextFunction } from 'express'

export function moduleGuard(moduleName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const enabledModules = req.app.get('enabledModules') as string[]

    // Check static enabledModules first
    if (enabledModules.includes(moduleName)) {
      next()
      return
    }

    // Fallback: check settings table for dynamic module activation
    const pool = req.app.get('pool')
    if (pool) {
      try {
        const result = await pool.query(
          `SELECT value FROM settings WHERE key = 'license_addons' LIMIT 1`
        )
        if (result.rows[0]?.value) {
          const addons: string[] = JSON.parse(result.rows[0].value)
          if (addons.includes(moduleName)) {
            next()
            return
          }
        }
      } catch {
        // Settings table may not exist yet; fall through to static check
      }
    }

    res.status(403).json({
      error: 'MODULE_NOT_LICENSED',
      message: `El módulo ${moduleName} no está incluido en su licencia.`,
      addon: moduleName,
    })
  }
}
