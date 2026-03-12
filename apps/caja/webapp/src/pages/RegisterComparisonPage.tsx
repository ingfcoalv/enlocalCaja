import { useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, Loader2, Monitor } from 'lucide-react'

interface RegisterComparisonRow {
  registerId: string
  registerName: string
  shiftsCount: number
  totalSales: number
  totalCash: number
  totalCard: number
  totalTransfer: number
  totalDeposits: number
  totalWithdrawals: number
  transactionsCount: number
  averageTicket: number
  difference: number
}

export default function RegisterComparisonPage() {
  const toast = useToast()
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [dateFrom, setDateFrom] = useState(() => firstOfMonth.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RegisterComparisonRow[]>([])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/reports/register-comparison', {
        params: { from: dateFrom, to: dateTo },
      })
      setRows(data?.data ?? [])
    } catch {
      toast.error('Error al cargar comparacion de cajas')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: string | number | null) => {
    const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
  }

  const totalRegisters = rows.length
  const totalSales = rows.reduce((s, r) => s + r.totalSales, 0)
  const totalTxns = rows.reduce((s, r) => s + r.transactionsCount, 0)

  const totalsRow = {
    shiftsCount: rows.reduce((s, r) => s + r.shiftsCount, 0),
    totalSales,
    totalCash: rows.reduce((s, r) => s + r.totalCash, 0),
    totalCard: rows.reduce((s, r) => s + r.totalCard, 0),
    totalTransfer: rows.reduce((s, r) => s + r.totalTransfer, 0),
    totalDeposits: rows.reduce((s, r) => s + r.totalDeposits, 0),
    totalWithdrawals: rows.reduce((s, r) => s + r.totalWithdrawals, 0),
    transactionsCount: totalTxns,
    averageTicket: totalTxns > 0 ? totalSales / totalTxns : 0,
    difference: rows.reduce((s, r) => s + r.difference, 0),
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comparacion de Cajas</h1>
        <p className="mt-1 text-sm text-gray-500">Comparativa lado a lado de todas las cajas registradoras</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          type="button"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          Consultar
        </button>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total cajas</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{totalRegisters}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Ventas combinadas</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total transacciones</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{totalTxns}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Detalle por Caja</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Caja</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Turnos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ventas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Efectivo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Tarjeta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Transferencia</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Depositos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Retiros</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Transacciones</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ticket Promedio</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const diff = row.difference
                  return (
                    <tr key={row.registerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-medium">{row.registerName}</td>
                      <td className="px-4 py-3 text-right text-xs">{row.shiftsCount}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium">{formatCurrency(row.totalSales)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalCash)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalCard)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalTransfer)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalDeposits)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalWithdrawals)}</td>
                      <td className="px-4 py-3 text-right text-xs">{row.transactionsCount}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">{formatCurrency(row.averageTicket)}</td>
                      <td
                        className={`px-4 py-3 text-right text-xs font-mono font-medium ${
                          diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-600'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                      </td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-xs">Totales</td>
                  <td className="px-4 py-3 text-right text-xs">{totalsRow.shiftsCount}</td>
                  <td className="px-4 py-3 text-right text-xs">{formatCurrency(totalsRow.totalSales)}</td>
                  <td className="px-4 py-3 text-right text-xs">{formatCurrency(totalsRow.totalCash)}</td>
                  <td className="px-4 py-3 text-right text-xs">{formatCurrency(totalsRow.totalCard)}</td>
                  <td className="px-4 py-3 text-right text-xs">{formatCurrency(totalsRow.totalTransfer)}</td>
                  <td className="px-4 py-3 text-right text-xs">{formatCurrency(totalsRow.totalDeposits)}</td>
                  <td className="px-4 py-3 text-right text-xs">{formatCurrency(totalsRow.totalWithdrawals)}</td>
                  <td className="px-4 py-3 text-right text-xs">{totalsRow.transactionsCount}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono">{formatCurrency(totalsRow.averageTicket)}</td>
                  <td
                    className={`px-4 py-3 text-right text-xs font-mono ${
                      totalsRow.difference < 0 ? 'text-red-600' : totalsRow.difference > 0 ? 'text-green-600' : 'text-gray-600'
                    }`}
                  >
                    {totalsRow.difference > 0 ? '+' : ''}{formatCurrency(totalsRow.difference)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
          <Monitor className="mb-3 h-12 w-12" />
          <p className="text-sm">Selecciona un rango de fechas y presiona Consultar</p>
        </div>
      )}
    </div>
  )
}
