import { useEffect } from 'react'
import { useLicenseStore } from '@enlocal/react-hooks'
import { CheckCircle, XCircle, Stamp } from 'lucide-react'

/**
 * License section for settings page.
 * Shows module list, stamps bar, license state.
 */
export function LicenseSettingsSection() {
  const { plan, licenseState, expiresAt, modules, stamps, loading, fetchFullInfo } = useLicenseStore()

  useEffect(() => {
    fetchFullInfo()
  }, [fetchFullInfo])

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-3/4 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  // Stamps bar color
  const stampsPercent = stamps.totalPurchased > 0
    ? Math.round((stamps.available / stamps.totalPurchased) * 100)
    : 0
  let barColor = 'bg-green-500'
  if (stamps.available === 0) barColor = 'bg-red-500'
  else if (stamps.available <= 10) barColor = 'bg-yellow-500'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Licencia</h3>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <span className="text-xs font-medium uppercase text-gray-500">Plan</span>
          <p className="text-sm font-semibold text-gray-900">{plan || 'N/A'}</p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase text-gray-500">Estado</span>
          <p className="text-sm font-semibold text-gray-900">{licenseState || 'N/A'}</p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase text-gray-500">Vence</span>
          <p className="text-sm font-semibold text-gray-900">
            {expiresAt ? new Date(expiresAt).toLocaleDateString('es-MX') : 'N/A'}
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700">Modulos</h4>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {modules.map((mod) => (
            <div key={mod.code} className="flex items-center gap-2 text-sm">
              {mod.active ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-300" />
              )}
              <span className={mod.active ? 'text-gray-900' : 'text-gray-400'}>
                {mod.code.replace('mod-', '')}
              </span>
              {mod.source === 'addon' && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  addon
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stamps */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <Stamp className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-700">Timbres CFDI</h4>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{stamps.available} disponibles</span>
            <span>{stamps.totalUsed} usados de {stamps.totalPurchased}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.max(stampsPercent, 2)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
