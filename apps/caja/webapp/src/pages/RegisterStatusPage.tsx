import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { Monitor, User, Clock, Loader2, RefreshCw } from 'lucide-react'

interface RegisterWithStatus {
  id: string
  name: string
  isActive: boolean
  currentShift: {
    id: string
    userId: string
    userName: string
    openedAt: string
  } | null
}

interface ShiftPreviewData {
  shiftId: string
  registerName: string | null
  openingAmount: number
  totalCashPayments: number
  totalCardPayments: number
  totalTransferPayments: number
  totalDeposits: number
  totalWithdrawals: number
  expectedAmount: number
  transactionsCount: number
  totalSales: number
}

export default function RegisterStatusPage() {
  const toast = useToast()
  const [registers, setRegisters] = useState<RegisterWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [previews, setPreviews] = useState<Record<string, ShiftPreviewData>>({})

  const fetchRegisters = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/pos/registers')
      const regs = data.data ?? data ?? []
      setRegisters(regs)

      // Fetch previews for open shifts
      const openRegs = regs.filter((r: RegisterWithStatus) => r.currentShift)
      const previewMap: Record<string, ShiftPreviewData> = {}
      await Promise.all(
        openRegs.map(async (reg: RegisterWithStatus) => {
          try {
            const { data: previewRes } = await api.get(`/api/pos/shifts/${reg.currentShift!.id}/preview`)
            const p = previewRes.data ?? previewRes
            previewMap[reg.id] = {
              shiftId: reg.currentShift!.id,
              registerName: p.registerName ?? reg.name,
              openingAmount: p.openingAmount ?? 0,
              totalCashPayments: p.totalCashPayments ?? 0,
              totalCardPayments: p.totalCardPayments ?? 0,
              totalTransferPayments: p.totalTransferPayments ?? 0,
              totalDeposits: p.totalDeposits ?? 0,
              totalWithdrawals: p.totalWithdrawals ?? 0,
              expectedAmount: p.expectedAmount ?? 0,
              transactionsCount: p.transactionsCount ?? 0,
              totalSales: p.totalSales ?? 0,
            }
          } catch { /* ignore preview errors */ }
        })
      )
      setPreviews(previewMap)
    } catch {
      toast.error('Error al cargar cajas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegisters()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estado de Cajas</h1>
          <p className="mt-1 text-sm text-gray-500">Vista en tiempo real de todas las cajas</p>
        </div>
        <button
          onClick={fetchRegisters}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {registers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
          <Monitor className="mb-3 h-12 w-12" />
          <p className="text-sm">No hay cajas configuradas</p>
          <p className="mt-1 text-xs">Ve a Configuracion &gt; Cajas para crear una</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {registers.map((reg) => {
            const isOpen = !!reg.currentShift
            const preview = previews[reg.id]

            return (
              <div
                key={reg.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                  isOpen ? 'border-primary-200' : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        isOpen ? 'bg-primary-100' : 'bg-gray-100'
                      }`}
                    >
                      <Monitor
                        className={`h-5 w-5 ${isOpen ? 'text-primary-600' : 'text-gray-400'}`}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{reg.name}</h3>
                      <span
                        className={`text-xs font-medium ${
                          isOpen ? 'text-primary-600' : 'text-gray-400'
                        }`}
                      >
                        {isOpen ? 'Abierta' : 'Cerrada'}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isOpen ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                </div>

                {isOpen && reg.currentShift ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <User className="h-3.5 w-3.5" />
                      <span>{reg.currentShift.userName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Desde {formatTime(reg.currentShift.openedAt)}</span>
                    </div>

                    {preview && (
                      <div className="mt-3 space-y-1 rounded-lg bg-gray-50 p-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Ventas</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(preview.totalSales)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Efectivo</span>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(preview.totalCashPayments)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Tarjeta</span>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(preview.totalCardPayments)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Transf.</span>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(preview.totalTransferPayments)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1">
                          <span className="text-gray-500">Depositos</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(preview.totalDeposits)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Retiros</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(preview.totalWithdrawals)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-gray-200 pt-1 mt-1">
                          <span className="text-gray-500 font-medium">Esperado</span>
                          <span className="font-bold text-primary-600">
                            {formatCurrency(preview.expectedAmount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Sin turno activo</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
