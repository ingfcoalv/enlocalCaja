import { useState } from 'react'
import { useLicenseStore } from '@enlocal/react-hooks'
import { Shield, Clock, CheckCircle, ExternalLink } from 'lucide-react'

export default function LicenseSettingsPage() {
  const { plan, licenseState, expiresAt, isTrial, trial } = useLicenseStore()
  const [serial, setSerial] = useState('')
  const [activating, setActivating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleActivate = async () => {
    if (!serial.trim()) {
      setResult({ success: false, message: 'Ingresa una clave de licencia' })
      return
    }

    setActivating(true)
    setResult(null)

    try {
      if (window.electronAPI) {
        const res = (await window.electronAPI.invoke('activate-license-from-webapp', serial.trim())) as {
          success: boolean
          message: string
        }
        setResult(res)
        if (res.success) {
          setSerial('')
        }
      } else {
        setResult({ success: false, message: 'Esta funcion solo esta disponible en la aplicacion de escritorio' })
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Error al activar la licencia' })
    } finally {
      setActivating(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--'
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const daysRemaining = trial?.daysRemaining ?? 0

  return (
    <div>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licencia</h1>
          <p className="text-sm text-gray-500">Estado de tu licencia y activacion</p>
        </div>

        {/* Trial banner */}
        {isTrial && (
          <div
            className={`rounded-lg border p-4 ${
              daysRemaining <= 3
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <Clock
                className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                  daysRemaining <= 3 ? 'text-red-500' : 'text-amber-500'
                }`}
              />
              <div className="flex-1">
                <h3
                  className={`text-sm font-semibold ${
                    daysRemaining <= 3 ? 'text-red-800' : 'text-amber-800'
                  }`}
                >
                  Periodo de prueba: {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante
                  {daysRemaining !== 1 ? 's' : ''}
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Vence el {formatDate(trial?.trialEndsAt ?? null)}. Compra tu licencia en{' '}
                  <a
                    href="https://todoenlocal.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    todoenlocal.com <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  para uso permanente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current license info */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-800">
              {isTrial ? 'Informacion del periodo de prueba' : 'Informacion de licencia'}
            </h2>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Estado</dt>
              <dd className="mt-0.5 font-medium">
                {isTrial ? (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Clock className="h-3.5 w-3.5" /> Periodo de prueba
                  </span>
                ) : licenseState === 'linked' || licenseState === 'activated' ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" /> Activa
                  </span>
                ) : (
                  <span className="text-gray-600">{licenseState || '--'}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Plan</dt>
              <dd className="mt-0.5 font-medium text-gray-800">
                {isTrial ? 'Completo (prueba)' : plan || '--'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Vigencia</dt>
              <dd className="mt-0.5 font-medium text-gray-800">
                {isTrial ? formatDate(trial?.trialEndsAt ?? null) : formatDate(expiresAt)}
              </dd>
            </div>
            {!isTrial && (
              <div>
                <dt className="text-gray-500">Sincronizacion</dt>
                <dd className="mt-0.5 font-medium text-green-600">Habilitada</dd>
              </div>
            )}
            {isTrial && (
              <div>
                <dt className="text-gray-500">Sincronizacion</dt>
                <dd className="mt-0.5 font-medium text-gray-400">No disponible en prueba</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Activation form */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {isTrial ? 'Activar licencia' : 'Cambiar licencia'}
          </h2>
          {isTrial && (
            <p className="text-xs text-gray-500 mb-4">
              Al activar una licencia, tus datos locales se conservan y la sincronizacion se habilitara automaticamente.
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="serial-input" className="block text-sm font-medium text-gray-600 mb-1">
                Clave de licencia
              </label>
              <input
                id="serial-input"
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="TEL-XXXXX-XXXXX-XXXXX"
                maxLength={23}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-sm tracking-wider focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                disabled={activating}
              />
            </div>

            {result && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  result.success
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {result.message}
              </div>
            )}

            <button
              onClick={handleActivate}
              disabled={activating || !serial.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activating ? 'Activando...' : 'Activar licencia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
