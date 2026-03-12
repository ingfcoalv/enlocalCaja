import { useEffect, useMemo } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { usePayableStore } from '../stores/usePayableStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? '$0.00' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PayablesCashFlowPage() {
  const { cashFlowProjection, loading, fetchCashFlowProjection } = usePayableStore()

  useEffect(() => {
    fetchCashFlowProjection()
  }, [fetchCashFlowProjection])

  // Normalize backend response: { weeks: [...], totalProjected } with snake_case fields
  const weeks = useMemo(() => {
    if (!cashFlowProjection) return []
    const raw = cashFlowProjection.weeks || cashFlowProjection.data || []
    if (!Array.isArray(raw)) return []
    return raw.map((w: any) => ({
      weekStart: w.week_start || w.weekStart || '',
      totalDue: Number(w.total_due ?? w.totalDue) || 0,
      count: Number(w.count) || 0,
    }))
  }, [cashFlowProjection])

  const totalProjected = useMemo(() => {
    if (cashFlowProjection?.totalProjected != null) return Number(cashFlowProjection.totalProjected)
    return weeks.reduce((sum, w) => sum + w.totalDue, 0)
  }, [cashFlowProjection, weeks])

  const maxAmount = Math.max(...weeks.map((w) => w.totalDue), 1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proyección de Flujo de Efectivo</h1>
        <p className="mt-1 text-sm text-gray-500">Pagos proyectados por semana</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Total card */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm text-gray-500 mb-1">Total Proyectado</p>
            <p className="text-3xl font-bold text-primary-600">{fmtMoney(totalProjected)}</p>
          </div>

          {weeks.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-500 shadow-sm">
              No hay pagos proyectados en las próximas semanas
            </div>
          ) : (
            <>
              {/* Bar chart */}
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Gráfica por Semana</h2>
                <div className="space-y-3">
                  {weeks.map((week, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-28 flex-shrink-0 text-xs text-gray-600 font-medium">
                        {fmtDate(week.weekStart)}
                      </div>
                      <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
                        <div
                          className="bg-primary-500 h-full flex items-center justify-end pr-2 transition-all duration-300 min-w-[40px]"
                          style={{ width: `${Math.max((week.totalDue / maxAmount) * 100, 5)}%` }}
                        >
                          <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                            {fmtMoney(week.totalDue)}
                          </span>
                        </div>
                      </div>
                      <div className="w-16 text-right text-xs text-gray-500">
                        {week.count} pago{week.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 font-medium text-gray-600">Semana</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Total a Pagar</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Pagos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{fmtDate(week.weekStart)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(week.totalDue)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{week.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(totalProjected)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-700">
                        {weeks.reduce((s, w) => s + w.count, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
