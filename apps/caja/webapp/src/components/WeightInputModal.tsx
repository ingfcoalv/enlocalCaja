import { useState, useEffect } from 'react'
import { X, Weight, Check, ArrowDown } from 'lucide-react'
import { useScaleStore } from '../stores/useScaleStore'

interface WeightProduct {
  id: string
  name: string
  price: number
  taxRate?: number
  saleUnit?: string | null
}

interface WeightInputModalProps {
  product: WeightProduct
  onConfirm: (quantity: number) => void
  onClose: () => void
}

export default function WeightInputModal({ product, onConfirm, onClose }: WeightInputModalProps) {
  const { weight: scaleWeight, unit: scaleUnit, stable, connected } = useScaleStore()
  const [manualWeight, setManualWeight] = useState('')

  const unit = product.saleUnit || 'kg'
  const displayWeight = manualWeight ? parseFloat(manualWeight) : 0
  const lineTotal = displayWeight * product.price

  // When scale weight changes and is stable, auto-fill manual input
  useEffect(() => {
    if (connected && stable && scaleWeight > 0) {
      setManualWeight(scaleWeight.toFixed(3))
    }
  }, [connected, stable, scaleWeight])

  const handleUseScaleWeight = () => {
    if (scaleWeight > 0) {
      setManualWeight(scaleWeight.toFixed(3))
    }
  }

  const handleConfirm = () => {
    const qty = parseFloat(manualWeight)
    if (!qty || qty <= 0) return
    onConfirm(qty)
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
            <p className="text-sm text-gray-500">{formatCurrency(product.price)} / {unit}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Live scale reading */}
          <div className={`rounded-xl border-2 p-4 text-center ${
            connected
              ? stable ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Weight className={`h-5 w-5 ${connected ? 'text-green-600' : 'text-gray-400'}`} />
              <span className="text-xs font-medium text-gray-500">
                {connected ? 'Bascula' : 'Bascula no conectada'}
              </span>
            </div>
            {connected ? (
              <>
                <p className="text-3xl font-bold tabular-nums text-gray-900">
                  {scaleWeight.toFixed(3)} <span className="text-lg text-gray-500">{scaleUnit}</span>
                </p>
                <p className={`text-xs mt-1 ${stable ? 'text-green-600' : 'text-yellow-600'}`}>
                  {stable ? 'Estable' : 'Estabilizando...'}
                </p>
                <button
                  onClick={handleUseScaleWeight}
                  className="mt-2 flex items-center gap-1.5 mx-auto rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                  type="button"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Usar peso
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">Ingresa la cantidad manualmente</p>
            )}
          </div>

          {/* Manual input */}
          <div>
            <label htmlFor="weight-input" className="mb-1.5 block text-sm font-medium text-gray-700">
              Cantidad manual
            </label>
            <div className="flex items-center gap-2">
              <input
                id="weight-input"
                type="number"
                step="0.001"
                min="0"
                value={manualWeight}
                onChange={(e) => setManualWeight(e.target.value)}
                placeholder="0.000"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-right text-lg font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                autoFocus={!connected}
              />
              <span className="text-sm font-medium text-gray-500">{unit}</span>
            </div>
          </div>

          {/* Line total */}
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-center">
            <span className="text-sm text-gray-500">Total: </span>
            <span className="text-xl font-bold text-primary-600">{formatCurrency(lineTotal)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!manualWeight || parseFloat(manualWeight) <= 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400"
            type="button"
          >
            <Check className="h-4 w-4" />
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
