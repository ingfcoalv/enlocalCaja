import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Loader2 } from 'lucide-react'

interface RegisterOption {
  id: string
  name: string
}

interface UserOption {
  id: string
  name: string
}

interface ShiftRow {
  id: string
  userName: string | null
  registerName: string | null
  closedAt: string | null
  totalSales: string | null
  expectedAmount: string | null
  closingAmount: string | null
  difference: string | null
}

const formatCurrency = (val: string | number | null): string => {
  const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0)
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function ShiftDifferencesPage() {
  const toast = useToast()

  const [dateFrom, setDateFrom] = useState(() => {
    const firstOfMonth = new Date(); firstOfMonth.setDate(1)
    return firstOfMonth.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [registers, setRegisters] = useState<RegisterOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedRegister, setSelectedRegister] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [shifts, setShifts] = useState<ShiftRow[]>([])

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [regsRes, usersRes] = await Promise.all([
          api.get('/api/pos/registers'),
          api.get('/api/users'),
        ])
        setRegisters((regsRes.data?.data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
        setUsers((usersRes.data?.data ?? usersRes.data ?? []).map((u: any) => ({ id: u.id, name: u.name ?? u.username ?? '' })))
      } catch { /* ignore */ }
    }
    fetchFilters()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/api/pos/shifts/history', {
        params: {
          from: dateFrom,
          to: dateTo,
          registerId: selectedRegister || undefined,
          userId: selectedUser || undefined,
          limit: 200,
        },
      })
      const rows: ShiftRow[] = (res?.data ?? []).map((r: any) => ({
        id: r.id,
        userName: r.userName ?? r.user_name ?? null,
        registerName: r.registerName ?? r.register_name ?? null,
        closedAt: r.closedAt ?? r.closed_at ?? null,
        totalSales: r.totalSales ?? r.total_sales ?? null,
        expectedAmount: r.expectedAmount ?? r.expected_amount ?? null,
        closingAmount: r.closingAmount ?? r.closing_amount ?? null,
        difference: r.difference ?? null,
      }))

      // Filter to only shifts with non-zero difference
      const filtered = rows.filter((s) => {
        if (s.closingAmount === null || s.difference === null) return false
        const diff = parseFloat(s.difference)
        return diff !== 0 && !isNaN(diff)
      })

      setShifts(filtered)
    } catch {
      toast.error('Error al cargar historial de cortes')
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  const differences = shifts.map((s) => parseFloat(s.difference ?? '0'))
  const totalDifference = differences.reduce((s, d) => s + d, 0)
  const mostNegative = differences.length > 0 ? Math.min(...differences) : 0
  const mostPositive = differences.length > 0 ? Math.max(...differences) : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Diferencias en Cortes</h1>
        <p className="mt-1 text-sm text-gray-500">Auditoria de cortes de caja con diferencias</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Caja</label>
          <select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todas las cajas</option>
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todos los cajeros</option>
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

      {/* Summary Cards */}
      {shifts.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Total cortes con diferencia</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{shifts.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Diferencia acumulada</p>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${totalDifference < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                {totalDifference < 0
                  ? <ArrowDown className="h-4 w-4 text-red-600" />
                  : <ArrowUp className="h-4 w-4 text-green-600" />}
              </div>
            </div>
            <p className={`mt-2 text-xl font-bold ${totalDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalDifference > 0 ? '+' : ''}{formatCurrency(totalDifference)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Mayor faltante</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <ArrowDown className="h-4 w-4 text-red-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-red-600">
              {mostNegative < 0 ? formatCurrency(mostNegative) : '-'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Mayor sobrante</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <ArrowUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-green-600">
              {mostPositive > 0 ? `+${formatCurrency(mostPositive)}` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Shifts Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Cortes con diferencia</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-medium text-gray-600">Cajero</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-600">Caja</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-600">Fecha Cierre</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ventas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Esperado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Contado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando cortes...</p>
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No se encontraron cortes con diferencia</p>
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => {
                  const diff = parseFloat(shift.difference ?? '0')
                  const rowBg = diff < 0 ? 'bg-red-50' : 'bg-green-50'
                  return (
                    <tr key={shift.id} className={`border-b border-gray-100 ${rowBg}`}>
                      <td className="px-4 py-3 text-gray-900">{shift.userName ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{shift.registerName ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(shift.closedAt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(shift.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {formatCurrency(shift.expectedAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {formatCurrency(shift.closingAmount)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
