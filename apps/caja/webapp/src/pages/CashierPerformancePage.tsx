import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, Loader2, Users } from 'lucide-react'

interface RegisterOption {
  id: string
  name: string
}

interface UserOption {
  id: string
  name: string
}

interface CashierPerformanceRow {
  userId: string
  userName: string
  shiftsCount: number
  totalSales: number
  totalCash: number
  totalCard: number
  totalTransfer: number
  transactionsCount: number
  averageTicket: number
  averageSalesPerShift: number
  accumulatedDifference: number
}

export default function CashierPerformancePage() {
  const toast = useToast()
  const [registers, setRegisters] = useState<RegisterOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedRegister, setSelectedRegister] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [dateFrom, setDateFrom] = useState(() => firstOfMonth.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CashierPerformanceRow[]>([])

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [regsRes, usersRes] = await Promise.all([
          api.get('/api/pos/registers'),
          api.get('/api/users'),
        ])
        setRegisters((regsRes.data.data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
        setUsers((usersRes.data.data ?? []).map((u: any) => ({ id: u.id, name: u.name })))
      } catch { /* ignore */ }
    }
    fetchOptions()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        from: dateFrom,
        to: dateTo,
      }
      if (selectedRegister) params.registerId = selectedRegister
      if (selectedUser) params.userId = selectedUser
      const { data } = await api.get('/api/reports/cashier-performance', { params })
      setRows(data?.data ?? [])
    } catch {
      toast.error('Error al cargar rendimiento de cajeros')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: string | number | null) => {
    const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
  }

  const totalCashiers = rows.length
  const totalSales = rows.reduce((s, r) => s + r.totalSales, 0)
  const totalTxns = rows.reduce((s, r) => s + r.transactionsCount, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rendimiento de Cajeros</h1>
        <p className="mt-1 text-sm text-gray-500">Analisis de desempeno por cajero</p>
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
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Cajero</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
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
            <p className="text-xs text-gray-500">Cajeros mostrados</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{totalCashiers}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Ventas totales</p>
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
            <h2 className="text-sm font-semibold text-gray-900">Desempeno por Cajero</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Cajero</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Turnos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ventas Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Efectivo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Tarjeta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Transferencia</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Transacciones</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ticket Promedio</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Venta Promedio/Turno</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Diferencia Acumulada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const diff = row.accumulatedDifference
                  return (
                    <tr key={row.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-medium">{row.userName}</td>
                      <td className="px-4 py-3 text-right text-xs">{row.shiftsCount}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium">{formatCurrency(row.totalSales)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalCash)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalCard)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(row.totalTransfer)}</td>
                      <td className="px-4 py-3 text-right text-xs">{row.transactionsCount}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">{formatCurrency(row.averageTicket)}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">{formatCurrency(row.averageSalesPerShift)}</td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
          <Users className="mb-3 h-12 w-12" />
          <p className="text-sm">Selecciona un rango de fechas y presiona Consultar</p>
        </div>
      )}
    </div>
  )
}
