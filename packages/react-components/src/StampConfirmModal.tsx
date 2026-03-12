import { useLicenseStore } from '@enlocal/react-hooks'
import { AlertTriangle, X } from 'lucide-react'

interface StampConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

/**
 * Modal shown before stamping. Shows balance before/after.
 * Blocks if stamps = 0.
 */
export function StampConfirmModal({ open, onClose, onConfirm, loading }: StampConfirmModalProps) {
  const { stamps } = useLicenseStore()

  if (!open) return null

  const canStamp = stamps.available > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Confirmar timbrado
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {canStamp ? (
            <>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Timbres disponibles:</span>
                  <span className="font-semibold text-gray-900">{stamps.available}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-gray-600">Despues del timbrado:</span>
                  <span className="font-semibold text-gray-900">{stamps.available - 1}</span>
                </div>
              </div>
              {stamps.available <= 10 && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>Timbres bajos. Adquiere mas en todoenlocal.com</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-800">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Sin timbres disponibles</p>
                <p className="mt-1">Adquiere mas timbres en todoenlocal.com para continuar facturando.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Cancelar
          </button>
          {canStamp && (
            <button
              onClick={onConfirm}
              disabled={loading}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              type="button"
            >
              {loading ? 'Timbrando...' : 'Timbrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
