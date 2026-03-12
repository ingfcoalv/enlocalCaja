import { useState, useEffect, useCallback } from 'react'
import { Key, Shield, CheckCircle, AlertCircle, Loader2, Copy } from 'lucide-react'

interface ActivationResult {
  success: boolean
  message?: string
}

export function ActivationScreen(): JSX.Element {
  const [serialParts, setSerialParts] = useState<[string, string, string]>(['', '', ''])
  const [fingerprint, setFingerprint] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchFingerprint = async () => {
      const api = window.electronAPI
      if (!api) {
        setFingerprint('No disponible (modo navegador)')
        return
      }

      try {
        const fp = (await api.invoke('get-fingerprint')) as string
        setFingerprint(fp || 'No disponible')
      } catch {
        setFingerprint('Error al obtener fingerprint')
      }
    }

    fetchFingerprint()
  }, [])

  const handlePartChange = useCallback(
    (index: number, value: string) => {
      const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
      const newParts: [string, string, string] = [...serialParts] as [string, string, string]
      newParts[index] = cleaned
      setSerialParts(newParts)
      setError(null)
      setSuccess(null)

      // Auto-focus next input when current is complete
      if (cleaned.length === 5 && index < 2) {
        const nextInput = document.getElementById(`serial-part-${index + 1}`)
        nextInput?.focus()
      }
    },
    [serialParts]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      // Backspace on empty input focuses previous
      if (e.key === 'Backspace' && serialParts[index] === '' && index > 0) {
        const prevInput = document.getElementById(`serial-part-${index - 1}`)
        prevInput?.focus()
      }
    },
    [serialParts]
  )

  const getFullSerial = useCallback((): string => {
    return `TEL-${serialParts[0]}-${serialParts[1]}-${serialParts[2]}`
  }, [serialParts])

  const isSerialComplete = serialParts.every((part) => part.length === 5)

  const handleActivate = useCallback(async () => {
    if (!isSerialComplete) {
      setError('Completa todos los campos del serial')
      return
    }

    const api = window.electronAPI
    if (!api) {
      setError('API de Electron no disponible')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const serial = getFullSerial()
      const result = (await api.invoke('activate-license', serial)) as ActivationResult

      if (result.success) {
        setSuccess(result.message || 'Licencia activada exitosamente')
        // Initialize DB (create default admin user + sync license to settings)
        try {
          await fetch('/api/setup/init', { method: 'POST' })
        } catch {
          // Non-critical — server may handle this on restart
        }
        // Redirect to login after a brief delay so user sees the success message
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
      } else {
        setError(result.message || 'No se pudo activar la licencia')
      }
    } catch {
      setError('Error al activar la licencia. Verifica tu serial e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [isSerialComplete, getFullSerial])

  const handleCopyFingerprint = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fingerprint)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }, [fingerprint])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <Shield className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Activar licencia</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingresa tu clave de licencia para activar el sistema
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Serial key input */}
          <div className="mb-6">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Key className="h-4 w-4" />
              Clave de licencia
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-gray-500">TEL</span>
              <span className="text-gray-300">-</span>
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    id={`serial-part-${index}`}
                    type="text"
                    maxLength={5}
                    value={serialParts[index]}
                    onChange={(e) => handlePartChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    placeholder="XXXXX"
                    disabled={loading}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-2.5 text-center font-mono text-sm uppercase tracking-wider transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100"
                  />
                  {index < 2 && <span className="text-gray-300">-</span>}
                </div>
              ))}
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Formato: TEL-XXXXX-XXXXX-XXXXX
            </p>
          </div>

          {/* Machine fingerprint */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Huella del equipo (fingerprint)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs text-gray-700">
                {fingerprint || 'Cargando...'}
              </code>
              {fingerprint && (
                <button
                  onClick={handleCopyFingerprint}
                  className="flex-shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                  type="button"
                  title="Copiar fingerprint"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {copied && (
              <p className="mt-1 text-xs text-green-600">Copiado al portapapeles</p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Activate button */}
          <button
            onClick={handleActivate}
            disabled={!isSerialComplete || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500"
            type="button"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                Activar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
