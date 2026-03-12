import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, Loader2, Monitor } from 'lucide-react'

interface RegisterOption {
  id: string
  name: string
}

interface UserOption {
  id: string
  name: string
}

interface ShiftHistoryItem {
  id: string
  userId: string
  userName: string | null
  registerName: string | null
  openingAmount: string
  closingAmount: string | null
  expectedAmount: string | null
  difference: string | null
  totalSales: string | null
  totalCashSales: string | null
  totalCardSales: string | null
  totalTransferSales: string | null
  totalDeposits: string | null
  totalWithdrawals: string | null
  transactionsCount: number | null
  openedAt: string
  closedAt: string | null
}

export default function ShiftHistoryReportPage() {
  const toast = useToast()
  const [registers, setRegisters] = useState<RegisterOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedRegister, setSelectedRegister] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [dateFrom, setDateFrom] = useState(() => firstOfMonth.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [shifts, setShifts] = useState<ShiftHistoryItem[]>([])

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
        limit: '100',
      }
      if (selectedRegister) params.registerId = selectedRegister
      if (selectedUser) params.userId = selectedUser
      const { data } = await api.get('/api/pos/shifts/history', { params })
      setShifts(data?.data ?? [])
    } catch {
      toast.error('Error al cargar historial de turnos')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: string | number | null) => {
    const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const totalShifts = shifts.length
  const totalSales = shifts.reduce((s, sh) => s + parseFloat(sh.totalSales ?? '0'), 0)
  const totalTxns = shifts.reduce((s, sh) => s + (sh.transactionsCount ?? 0), 0)
  const avgDifference =
    totalShifts > 0
      ? shifts.reduce((s, sh) => s + parseFloat(sh.difference ?? '0'), 0) / totalShifts
      : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historial de Turnos</h1>
        <p className="mt-1 text-sm text-gray-500">Reporte completo de turnos por caja y cajero</p>
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
      {shifts.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total turnos</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{totalShifts}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total ventas</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Diferencia promedio</p>
            <p className={`mt-1 text-xl font-bold ${avgDifference < 0 ? 'text-red-600' : avgDifference > 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {avgDifference > 0 ? '+' : ''}{formatCurrency(avgDifference)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total transacciones</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{totalTxns}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {shifts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Detalle de Turnos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Cajero</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Caja</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Apertura</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-600">Cierre</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ventas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Efectivo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Tarjeta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Transferencia</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Depositos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Retiros</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Txns</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Esperado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Contado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map((shift) => {
                  const diff = parseFloat(shift.difference ?? '0')
                  return (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs">{shift.userName ?? '-'}</td>
                      <td className="px-4 py-3 text-xs">{shift.registerName ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(shift.openedAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {shift.closedAt ? formatDate(shift.closedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium">{formatCurrency(shift.totalSales)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(shift.totalCashSales)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(shift.totalCardSales)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(shift.totalTransferSales)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(shift.totalDeposits)}</td>
                      <td className="px-4 py-3 text-right text-xs">{formatCurrency(shift.totalWithdrawals)}</td>
                      <td className="px-4 py-3 text-right text-xs">{shift.transactionsCount ?? '-'}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">{formatCurrency(shift.expectedAmount)}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">{formatCurrency(shift.closingAmount)}</td>
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

      {!loading && shifts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
          <Monitor className="mb-3 h-12 w-12" />
          <p className="text-sm">Selecciona un rango de fechas y presiona Consultar</p>
        </div>
      )}
    </div>
  )
}
