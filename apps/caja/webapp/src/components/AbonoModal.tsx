import { useState } from 'react'
import { X, Banknote, CreditCard, ArrowRightLeft, Loader2 } from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface AbonoModalProps {
  invoiceId: string
  customerId: string
  invoiceFolio: string
  invoiceTotal: number
  totalPaid: number
  balance: number
  onClose: () => void
  onSuccess: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export default function AbonoModal({
  invoiceId,
  customerId,
  invoiceFolio,
  invoiceTotal,
  totalPaid,
  balance,
  onClose,
  onSuccess,
}: AbonoModalProps) {
  const toast = useToast()
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [reference, setReference] = useState('')
  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)

  const amountNum = parseFloat(amount) || 0
  const cashTenderedNum = parseFloat(cashTendered) || 0
  const cashChange = method === 'cash' ? cashTenderedNum - amountNum : 0

  const canConfirm =
    !processing &&
    amountNum > 0 &&
    amountNum <= balance + 0.01 &&
    (method !== 'cash' || cashTenderedNum >= amountNum || !cashTendered)

  const handleConfirm = async () => {
    setProcessing(true)
    try {
      await api.post('/api/credit/abonos', {
        customerId,
        invoiceId,
        payments: [
          {
            method,
            amount: amountNum,
            reference: reference || undefined,
          },
        ],
      })
      toast.success('Abono registrado exitosamente')
      onSuccess()
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Error al registrar abono'
      toast.error(message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Registrar Abono</h3>
          <button
            onClick={onClose}
            disabled={processing}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Sale info */}
          <div className="mb-4 rounded-lg bg-gray-50 p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Venta</span>
              <span className="font-mono text-gray-700">{invoiceFolio}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="text-gray-700">{formatCurrency(invoiceTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pagado</span>
              <span className="text-gray-700">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
              <span className="text-gray-700">Saldo pendiente</span>
              <span className="text-red-600">{formatCurrency(balance)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Metodo de pago
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'cash' as const, label: 'Efectivo', icon: Banknote, color: 'green' },
                { key: 'card' as const, label: 'Tarjeta', icon: CreditCard, color: 'blue' },
                { key: 'transfer' as const, label: 'Transfer.', icon: ArrowRightLeft, color: 'violet' },
              ]).map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition-colors ${
                    method === key
                      ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  type="button"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Monto del abono
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-right font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              autoFocus
            />
            {amountNum > balance && (
              <p className="mt-1 text-xs text-red-500">
                El monto no puede exceder el saldo pendiente
              </p>
            )}
          </div>

          {/* Reference for card/transfer */}
          {(method === 'card' || method === 'transfer') && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Referencia
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Numero de referencia..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          )}

          {/* Cash tendered */}
          {method === 'cash' && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Efectivo recibido
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={amountNum.toFixed(2)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-right font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              {cashTendered && cashChange >= 0 && (
                <div className="mt-2 rounded-lg bg-primary-50 p-3 text-center text-lg font-bold text-primary-700">
                  Cambio: {formatCurrency(cashChange)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            type="button"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </span>
            ) : (
              `Abonar ${formatCurrency(amountNum)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
