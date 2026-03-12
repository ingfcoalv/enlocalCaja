import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2, ChevronLeft, FileText, Download,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useReceivableStore } from '../stores/useReceivableStore'

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)

const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CustomerStatementPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { customerStatement, loading, fetchCustomerStatement } = useReceivableStore()

  useEffect(() => {
    if (customerId) fetchCustomerStatement(customerId)
  }, [customerId, fetchCustomerStatement])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  const stmt = customerStatement

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estado de Cuenta</h1>
          <p className="text-sm text-gray-500">
            {stmt?.customer?.name || 'Cliente'}
          </p>
        </div>
        {customerId && (
          <button
            onClick={async () => {
              try {
                const resp = await api.get(`/api/receivables/customer/${customerId}/statement/pdf`, { responseType: 'blob' })
                const url = URL.createObjectURL(resp.data)
                window.open(url, '_blank')
              } catch {
                toast.error('Error al generar PDF')
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Descargar PDF
          </button>
        )}
      </div>

      {/* Customer info */}
      {stmt?.customer && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Cliente</p>
              <p className="font-medium text-gray-900">{stmt.customer.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">RFC</p>
              <p className="font-medium text-gray-900">{stmt.customer.rfc || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Telefono</p>
              <p className="font-medium text-gray-900">{stmt.customer.phone || stmt.customer.cellphone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo actual</p>
              <p className={`text-lg font-bold ${stmt.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmtMoney(stmt.currentBalance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statement table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {!stmt || stmt.entries.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay movimientos</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600">Concepto</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Cargo</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Abono</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {stmt.entries.map((entry, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-500">{fmtDate(entry.date)}</td>
                  <td className="px-4 py-3 text-gray-900">{entry.concept}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">
                    {entry.charge > 0 ? fmtMoney(entry.charge) : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">
                    {entry.credit > 0 ? fmtMoney(entry.credit) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(entry.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">Saldo final</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {fmtMoney(stmt.entries.reduce((s, e) => s + e.charge, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-600">
                  {fmtMoney(stmt.entries.reduce((s, e) => s + e.credit, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {fmtMoney(stmt.currentBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
