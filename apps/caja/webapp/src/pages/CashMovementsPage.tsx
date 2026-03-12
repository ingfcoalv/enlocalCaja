import { useEffect, useState } from 'react'
import { useToast } from '@enlocal/react-hooks'
import { useCashMovementsStore } from '../stores/useCashMovementsStore'
import { usePosStore } from '../stores/usePosStore'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Loader2,
  Plus,
  X,
} from 'lucide-react'
import { api } from '@enlocal/react-hooks'

const REASON_LABELS: Record<string, string> = {
  change_fund: 'Fondo de cambio',
  expense: 'Gasto operativo',
  transfer_out: 'Transferencia (salida)',
  transfer_in: 'Transferencia (entrada)',
  correction: 'Correccion',
  other: 'Otro',
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposito',
  withdrawal: 'Retiro',
}

interface RegisterOption {
  id: string
  name: string
  isActive: boolean
  currentShift?: { id: string; userName: string } | null
}

export default function CashMovementsPage() {
  const toast = useToast()
  const { movements, loading, total, page, pages, fetchMovements, createMovement, createTransfer } =
    useCashMovementsStore()
  const { currentShift, currentRegister, fetchCurrentShift } = usePosStore()

  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'movement' | 'transfer'>('movement')
  const [formType, setFormType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [formAmount, setFormAmount] = useState('')
  const [formReason, setFormReason] = useState('change_fund')
  const [formNotes, setFormNotes] = useState('')
  const [formToRegisterId, setFormToRegisterId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registers, setRegisters] = useState<RegisterOption[]>([])

  // Filters
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    fetchCurrentShift()
    fetchMovements()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shiftOpen = currentShift && currentShift.status === 'open'

  const handleOpenMovementModal = () => {
    setModalMode('movement')
    setFormType('deposit')
    setFormAmount('')
    setFormReason('change_fund')
    setFormNotes('')
    setShowModal(true)
  }

  const handleOpenTransferModal = async () => {
    setModalMode('transfer')
    setFormAmount('')
    setFormNotes('')
    setFormToRegisterId('')
    setShowModal(true)
    try {
      const { data } = await api.get('/api/pos/registers')
      const regs = (data.data ?? []).filter(
        (r: RegisterOption) => r.id !== currentRegister?.id && r.currentShift
      )
      setRegisters(regs)
    } catch {
      setRegisters([])
    }
  }

  const handleSubmit = async () => {
    const amount = parseFloat(formAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto valido')
      return
    }

    setSubmitting(true)
    try {
      if (modalMode === 'movement') {
        await createMovement({
          type: formType,
          amount,
          reason: formReason,
          notes: formNotes || undefined,
        })
        toast.success(formType === 'deposit' ? 'Deposito registrado' : 'Retiro registrado')
      } else {
        if (!formToRegisterId) {
          toast.error('Selecciona la caja destino')
          setSubmitting(false)
          return
        }
        await createTransfer({
          toRegisterId: formToRegisterId,
          amount,
          notes: formNotes || undefined,
        })
        toast.success('Transferencia realizada')
        fetchMovements()
      }
      setShowModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Error al procesar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFilter = () => {
    fetchMovements({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      type: filterType || undefined,
    })
  }

  const formatCurrency = (amount: string | number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
      typeof amount === 'string' ? parseFloat(amount) : amount
    )

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimientos de Caja</h1>
          <p className="mt-1 text-sm text-gray-500">Depositos, retiros y transferencias entre cajas</p>
        </div>
        {shiftOpen && currentRegister && (
          <div className="flex gap-2">
            <button
              onClick={handleOpenMovementModal}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Movimiento
            </button>
            <button
              onClick={handleOpenTransferModal}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              type="button"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transferir
            </button>
          </div>
        )}
      </div>

      {!shiftOpen && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Debes tener un turno abierto con caja asignada para registrar movimientos.
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="deposit">Depositos</option>
            <option value="withdrawal">Retiros</option>
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          type="button"
        >
          Filtrar
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : movements.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-gray-400">
            <ArrowRightLeft className="mb-2 h-8 w-8" />
            <p className="text-sm">No hay movimientos registrados</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Razon</th>
                <th className="px-4 py-3 font-medium text-gray-600">Usuario</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Monto</th>
                <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(mov.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        mov.type === 'deposit'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {mov.type === 'deposit' ? (
                        <ArrowDownCircle className="h-3 w-3" />
                      ) : (
                        <ArrowUpCircle className="h-3 w-3" />
                      )}
                      {TYPE_LABELS[mov.type] ?? mov.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {REASON_LABELS[mov.reason] ?? mov.reason}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{mov.userName ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                    <span className={mov.type === 'deposit' ? 'text-green-700' : 'text-red-700'}>
                      {mov.type === 'deposit' ? '+' : '-'}
                      {formatCurrency(mov.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">
                    {mov.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
            <span>
              Pagina {page} de {pages} ({total} registros)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchMovements({ page: page - 1 })}
                disabled={page <= 1}
                className="rounded border px-2 py-1 disabled:opacity-30"
                type="button"
              >
                Anterior
              </button>
              <button
                onClick={() => fetchMovements({ page: page + 1 })}
                disabled={page >= pages}
                className="rounded border px-2 py-1 disabled:opacity-30"
                type="button"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Movement / Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              disabled={submitting}
              className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {modalMode === 'movement' ? 'Nuevo Movimiento' : 'Transferencia entre Cajas'}
            </h3>

            {modalMode === 'movement' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormType('deposit')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      formType === 'deposit'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    Deposito
                  </button>
                  <button
                    onClick={() => setFormType('withdrawal')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      formType === 'withdrawal'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    Retiro
                  </button>
                </div>
              </div>
            )}

            {modalMode === 'movement' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Razon</label>
                <select
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  <option value="change_fund">Fondo de cambio</option>
                  <option value="expense">Gasto operativo</option>
                  <option value="correction">Correccion</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            )}

            {modalMode === 'transfer' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Caja destino</label>
                {registers.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No hay otras cajas con turno abierto
                  </p>
                ) : (
                  <select
                    value={formToRegisterId}
                    onChange={(e) => setFormToRegisterId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  >
                    <option value="">Selecciona una caja</option>
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.currentShift ? ` (${r.currentShift.userName})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Monto</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-right font-mono text-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Notas (opcional)
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Descripcion del movimiento..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formAmount}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="button"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </span>
                ) : modalMode === 'movement' ? (
                  'Registrar'
                ) : (
                  'Transferir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
