import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, Loader2, ArrowDownUp } from 'lucide-react'

interface RegisterOption {
  id: string
  name: string
}

interface CashMovementRow {
  type: string
  reason: string
  count: number
  total: number
}

const REASON_LABELS: Record<string, string> = {
  change_fund: 'Fondo de cambio',
  expense: 'Gasto',
  transfer_out: 'Transferencia salida',
  transfer_in: 'Transferencia entrada',
  correction: 'Correccion',
  other: 'Otro',
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposito',
  withdrawal: 'Retiro',
}

export default function CashMovementsReportPage() {
  const toast = useToast()
  const [registers, setRegisters] = useState<RegisterOption[]>([])
  const [selectedRegister, setSelectedRegister] = useState('')
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [dateFrom, setDateFrom] = useState(() => firstOfMonth.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CashMovementRow[]>([])

  useEffect(() => {
    const fetchRegisters = async () => {
      try {
        const { data } = await api.get('/api/pos/registers')
        setRegisters((data.data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
      } catch { /* ignore */ }
    }
    fetchRegisters()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        from: dateFrom,
        to: dateTo,
      }
      if (selectedRegister) params.registerId = selectedRegister
      const { data } = await api.get('/api/reports/cash-movements', { params })
      setRows(data?.data ?? [])
    } catch {
      toast.error('Error al cargar movimientos de efectivo')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: string | number | null) => {
    const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
  }

  const totalDeposits = rows
    .filter((r) => r.type === 'deposit')
    .reduce((s, r) => s + r.total, 0)
  const totalWithdrawals = rows
    .filter((r) => r.type === 'withdrawal')
    .reduce((s, r) => s + r.total, 0)
  const netMovement = totalDeposits - totalWithdrawals

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Movimientos de Efectivo</h1>
        <p className="mt-1 text-sm text-gray-500">Analisis de depositos y retiros por tipo y razon</p>
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
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Caja</label>
          <select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
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
            <p className="text-xs text-gray-500">Total Depositos</p>
            <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(totalDeposits)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Retiros</p>
            <p className="mt-1 text-xl font-bold text-red-600">{formatCurrency(totalWithdrawals)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Movimiento Neto</p>
            <p className={`mt-1 text-xl font-bold ${netMovement < 0 ? 'text-red-600' : netMovement > 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {netMovement > 0 ? '+' : ''}{formatCurrency(netMovement)}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Detalle por Tipo y Razon</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Razon</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={`${row.type}-${row.reason}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.type === 'deposit'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{REASON_LABELS[row.reason] ?? row.reason}</td>
                    <td className="px-4 py-3 text-right text-xs">{row.count}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium font-mono">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
          <ArrowDownUp className="mb-3 h-12 w-12" />
          <p className="text-sm">Selecciona un rango de fechas y presiona Consultar</p>
        </div>
      )}
    </div>
  )
}
