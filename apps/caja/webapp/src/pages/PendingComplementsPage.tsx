import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, ChevronLeft, FileWarning,
} from 'lucide-react'
import { useReceivableStore } from '../stores/useReceivableStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtDateTime = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PendingComplementsPage() {
  const navigate = useNavigate()
  const { pendingComplements, loading, fetchPendingComplements } = useReceivableStore()

  useEffect(() => {
    fetchPendingComplements()
  }, [fetchPendingComplements])

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/receivables')} className="rounded-lg p-2 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complementos Pendientes</h1>
          <p className="text-sm text-gray-500">Pagos sin complemento de pago CFDI emitido</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : pendingComplements.length === 0 ? (
          <div className="py-20 text-center">
            <FileWarning className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No hay complementos pendientes</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Fecha de pago</th>
                <th className="px-4 py-3 font-medium text-gray-600">CxC</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Monto</th>
                <th className="px-4 py-3 font-medium text-gray-600">Metodo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Referencia</th>
                <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
              </tr>
            </thead>
            <tbody>
              {pendingComplements.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{fmtDateTime(p.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600">#{p.receivableId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.paymentMethod === 'cash' ? 'Efectivo'
                      : p.paymentMethod === 'transfer' ? 'Transferencia'
                      : p.paymentMethod === 'debit' ? 'Debito'
                      : p.paymentMethod === 'credit' ? 'Credito'
                      : p.paymentMethod === 'check' ? 'Cheque'
                      : p.paymentMethod}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.reference || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary */}
      {pendingComplements.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-yellow-800">
              {pendingComplements.length} pago(s) sin complemento CFDI
            </span>
            <span className="font-bold text-yellow-900">
              Total: {fmtMoney(pendingComplements.reduce((s, p) => s + parseFloat(p.amount), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
