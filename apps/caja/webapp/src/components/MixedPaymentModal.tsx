import { useState } from 'react'
import {
  X,
  Plus,
  Trash2,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Landmark,
  Loader2,
} from 'lucide-react'

interface PaymentRow {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: string
  reference: string
}

interface MixedPaymentModalProps {
  total: number
  subtotal: number
  tax: number
  customerId: string | null
  customerName: string | null
  customerCreditLimit?: number
  onConfirm: (payments: { method: string; amount: number; reference?: string }[], cashTendered?: number) => Promise<void>
  onClose: () => void
}

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  credit: 'Credito',
}

const methodIcons: Record<string, any> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowRightLeft,
  credit: Landmark,
}

const methodColors: Record<string, string> = {
  cash: 'bg-green-600 hover:bg-green-700',
  card: 'bg-blue-600 hover:bg-blue-700',
  transfer: 'bg-violet-600 hover:bg-violet-700',
  credit: 'bg-amber-600 hover:bg-amber-700',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export default function MixedPaymentModal({
  total,
  subtotal,
  tax,
  customerId,
  customerName,
  customerCreditLimit = 0,
  onConfirm,
  onClose,
}: MixedPaymentModalProps) {
  const [rows, setRows] = useState<PaymentRow[]>([
    { id: '1', method: 'cash', amount: total.toFixed(2), reference: '' },
  ])
  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)

  const totalAssigned = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const remaining = total - totalAssigned

  const cashRow = rows.find((r) => r.method === 'cash')
  const cashAmount = cashRow ? parseFloat(cashRow.amount) || 0 : 0
  const cashTenderedNum = parseFloat(cashTendered) || 0
  const cashChange = cashRow ? cashTenderedNum - cashAmount : 0

  const hasCredit = rows.some((r) => r.method === 'credit' && parseFloat(r.amount) > 0)
  const creditAmount = rows
    .filter((r) => r.method === 'credit')
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  const addRow = (method: PaymentRow['method']) => {
    const remainingAmount = Math.max(0, remaining)
    setRows([
      ...rows,
      {
        id: `${Date.now()}`,
        method,
        amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '',
        reference: '',
      },
    ])
  }

  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    setRows(rows.filter((r) => r.id !== id))
  }

  const updateRow = (id: string, field: keyof PaymentRow, value: string) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const canConfirm =
    !processing &&
    Math.abs(remaining) < 0.01 &&
    rows.every((r) => parseFloat(r.amount) > 0) &&
    (!cashRow || cashTenderedNum >= cashAmount || !cashTendered) &&
    (!hasCredit || customerId) &&
    (!hasCredit || creditAmount <= customerCreditLimit)

  const handleConfirm = async () => {
    setProcessing(true)
    try {
      const payments = rows.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount) || 0,
        reference: r.reference || undefined,
      }))
      await onConfirm(payments, cashRow ? cashTenderedNum : undefined)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Cobrar venta</h3>
          <button
            onClick={onClose}
            disabled={processing}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {/* Totals summary */}
          <div className="mb-4 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>IVA</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
              <span>Total</span>
              <span className="text-primary-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment rows */}
          <div className="mb-4 space-y-3">
            {rows.map((row) => {
              const Icon = methodIcons[row.method]
              return (
                <div key={row.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded text-white ${methodColors[row.method].split(' ')[0]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <select
                      value={row.method}
                      onChange={(e) => updateRow(row.id, 'method', e.target.value)}
                      className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                      {customerId && <option value="credit">Credito</option>}
                    </select>
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-red-400 hover:text-red-600"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                      placeholder="Monto"
                      className="flex-1 rounded border border-gray-200 px-3 py-2 text-right font-mono text-sm focus:border-primary-500 focus:outline-none"
                    />
                    {(row.method === 'card' || row.method === 'transfer') && (
                      <input
                        type="text"
                        value={row.reference}
                        onChange={(e) => updateRow(row.id, 'reference', e.target.value)}
                        placeholder="Referencia"
                        className="w-32 rounded border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    )}
                  </div>
                  {row.method === 'credit' && !customerId && (
                    <p className="mt-1 text-xs text-red-500">Selecciona un cliente para usar credito</p>
                  )}
                  {row.method === 'credit' && customerId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Credito disponible: {formatCurrency(customerCreditLimit)}
                      {creditAmount > customerCreditLimit && (
                        <span className="text-red-500 ml-1">- Limite excedido</span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add payment method buttons */}
          <div className="mb-4 flex gap-2">
            {(['cash', 'card', 'transfer', 'credit'] as const).map((method) => {
              if (method === 'credit' && !customerId) return null
              const Icon = methodIcons[method]
              return (
                <button
                  key={method}
                  onClick={() => addRow(method)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  type="button"
                >
                  <Plus className="h-3 w-3" />
                  <Icon className="h-3.5 w-3.5" />
                  {methodLabels[method]}
                </button>
              )
            })}
          </div>

          {/* Remaining balance */}
          <div className={`mb-4 rounded-lg p-3 text-center text-sm font-semibold ${
            Math.abs(remaining) < 0.01
              ? 'bg-green-50 text-green-700'
              : remaining > 0
              ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {Math.abs(remaining) < 0.01
              ? 'Monto completo asignado'
              : remaining > 0
              ? `Falta asignar: ${formatCurrency(remaining)}`
              : `Excede por: ${formatCurrency(Math.abs(remaining))}`}
          </div>

          {/* Cash tendered input */}
          {cashRow && (
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
                placeholder={cashAmount.toFixed(2)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-right font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              {cashTendered && cashChange >= 0 && (
                <div className="mt-2 rounded-lg bg-primary-50 p-3 text-center text-lg font-bold text-primary-700">
                  Cambio: {formatCurrency(cashChange)}
                </div>
              )}
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[50, 100, 200, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCashTendered(amount.toString())}
                    className="rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    type="button"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Credit warning */}
          {hasCredit && customerName && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Se cargara {formatCurrency(creditAmount)} al credito de <strong>{customerName}</strong>
            </div>
          )}
        </div>

        {/* Footer */}
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
              'Confirmar pago'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
