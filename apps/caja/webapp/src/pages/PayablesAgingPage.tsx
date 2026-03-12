import { useEffect } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'
import { usePayableStore } from '../stores/usePayableStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? '$0.00' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

export default function PayablesAgingPage() {
  const { agingReport, loading, fetchAgingReport } = usePayableStore()

  useEffect(() => {
    fetchAgingReport()
  }, [fetchAgingReport])

  const rows = agingReport?.rows || []
  const totals = agingReport?.totals || {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    total: 0,
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Antigüedad de Saldos - CxP</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reporte de cuentas por pagar agrupadas por antigüedad
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">
            No hay cuentas por pagar registradas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-600">Proveedor</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Vigente</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">1-30 días</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">31-60 días</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">61-90 días</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">+90 días</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.supplierName}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.current)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.days1to30)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.days31to60)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.days61to90)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.days90plus)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totals.current)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totals.days1to30)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totals.days31to60)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totals.days61to90)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totals.days90plus)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
