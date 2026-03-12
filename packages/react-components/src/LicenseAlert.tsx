import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ExpiryWarningData {
  daysRemaining: number
  expiresAt: string
}

const SESSION_KEY = 'enlocal:license-alert-dismissed'

export function LicenseAlert(): JSX.Element | null {
  const [warning, setWarning] = useState<ExpiryWarningData | null>(null)
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const api = window.electronAPI as { on: (ch: string, cb: (...args: unknown[]) => void) => void; removeListener: (ch: string, cb: (...args: unknown[]) => void) => void; invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } | undefined
    if (!api) return

    const handler = (...args: unknown[]) => {
      const data = args[0] as ExpiryWarningData
      if (data && typeof data.daysRemaining === 'number') {
        setWarning(data)
      }
    }

    api.on('license:expiry-warning', handler)

    return () => {
      api.removeListener('license:expiry-warning', handler)
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(SESSION_KEY, 'true')
    } catch {
      // sessionStorage not available
    }
  }

  if (!warning || dismissed) {
    return null
  }

  const formattedDate = (() => {
    try {
      return new Date(warning.expiresAt).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return warning.expiresAt
    }
  })()

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-800 shadow-sm">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
        <p className="text-sm font-medium">
          Tu licencia vence en{' '}
          <span className="font-bold">{warning.daysRemaining} dias</span> ({formattedDate}).
          Renueva en{' '}
          <a
            href="https://todoenlocal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-yellow-900"
          >
            todoenlocal.com
          </a>
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 rounded p-1 text-yellow-600 transition-colors hover:bg-yellow-100 hover:text-yellow-800"
        aria-label="Cerrar alerta"
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
