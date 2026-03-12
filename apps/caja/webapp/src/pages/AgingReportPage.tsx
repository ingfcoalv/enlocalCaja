import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, ChevronLeft, Calendar, Download,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useReceivableStore } from '../stores/useReceivableStore'

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)

export default function AgingReportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { agingReport, loading, fetchAgingReport } = useReceivableStore()
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    fetchAgingReport(asOfDate)
  }, [fetchAgingReport, asOfDate])

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/receivables')} className="rounded-lg p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Antiguedad de Saldos</h1>
            <p className="text-sm text-gray-500">Reporte de cartera por vencimiento</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <button
            onClick={async () => {
              try {
                const resp = await api.get('/api/receivables/aging-report/pdf', {
                  params: { as_of_date: asOfDate },
                  responseType: 'blob',
                })
                const url = URL.createObjectURL(resp.data)
                window.open(url, '_blank')
              } catch {
                toast.error('Error al generar PDF')
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Descargar PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !agingReport || agingReport.rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay saldos pendientes</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Vigente</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">1-30 dias</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">31-60 dias</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">61-90 dias</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">90+ dias</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {agingReport.rows.map((row) => (
                <tr
                  key={row.customerId}
                  onClick={() => navigate(`/receivables/statement/${row.customerId}`)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.customerName}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.current ? fmtMoney(row.current) : '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.days1to30 ? fmtMoney(row.days1to30) : '-'}</td>
                  <td className="px-4 py-3 text-right text-yellow-600 font-medium">{row.days31to60 ? fmtMoney(row.days31to60) : '-'}</td>
                  <td className="px-4 py-3 text-right text-orange-600 font-medium">{row.days61to90 ? fmtMoney(row.days61to90) : '-'}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{row.days90plus ? fmtMoney(row.days90plus) : '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-4 py-3 text-gray-900">Totales</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmtMoney(agingReport.totals.current)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmtMoney(agingReport.totals.days1to30)}</td>
                <td className="px-4 py-3 text-right text-yellow-700">{fmtMoney(agingReport.totals.days31to60)}</td>
                <td className="px-4 py-3 text-right text-orange-700">{fmtMoney(agingReport.totals.days61to90)}</td>
                <td className="px-4 py-3 text-right text-red-700">{fmtMoney(agingReport.totals.days90plus)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{fmtMoney(agingReport.totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Summary cards */}
      {agingReport && agingReport.rows.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Clientes con saldo</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{agingReport.rows.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Cartera total</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{fmtMoney(agingReport.totals.total)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Vigente</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{fmtMoney(agingReport.totals.current)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Vencido</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {fmtMoney(
                agingReport.totals.days1to30 +
                agingReport.totals.days31to60 +
                agingReport.totals.days61to90 +
                agingReport.totals.days90plus
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
