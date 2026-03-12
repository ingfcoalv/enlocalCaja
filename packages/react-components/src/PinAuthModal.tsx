import { useState, useRef, useEffect } from 'react'

interface PinAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthorize: (pin: string, authorizer: { id: string; name: string; role: string }) => void
  reason: string
  requiredRoles?: string[]
  apiBaseUrl?: string
}

export function PinAuthModal({ isOpen, onClose, onAuthorize, reason, requiredRoles, apiBaseUrl }: PinAuthModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', ''])
      setError('')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value.slice(-1)
    setDigits(newDigits)
    setError('')

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newDigits = [...digits]
    for (let i = 0; i < text.length; i++) {
      newDigits[i] = text[i]
    }
    setDigits(newDigits)
    if (text.length > 0) {
      const focusIdx = Math.min(text.length, 5)
      inputRefs.current[focusIdx]?.focus()
    }
  }

  const handleAuthorize = async () => {
    const pin = digits.join('')
    if (pin.length < 4) {
      setError('Ingresa el PIN completo')
      return
    }

    setLoading(true)
    setError('')
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('enlocal_token') : null
      const baseUrl = apiBaseUrl || ''
      const resp = await fetch(`${baseUrl}/api/auth/authorize-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pin, required_roles: requiredRoles }),
      })

      const data = await resp.json()
      if (data.authorized) {
        onAuthorize(pin, data.authorizer)
      } else {
        setError(data.reason || 'No autorizado')
        setDigits(['', '', '', '', '', ''])
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          Autorizacion Requerida
        </h3>
        <p className="mb-5 text-sm text-gray-600">{reason}</p>

        {/* PIN input boxes */}
        <div className="mb-4 flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-10 rounded-lg border-2 border-gray-300 text-center text-xl font-bold text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          ))}
        </div>

        {error && (
          <p className="mb-3 text-center text-sm font-medium text-red-600">{error}</p>
        )}

        <p className="mb-4 text-center text-xs text-gray-400">
          Ingrese el PIN de un usuario autorizado
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAuthorize}
            disabled={loading || digits.join('').length < 4}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Autorizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
