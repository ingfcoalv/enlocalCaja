import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, BarChart3, FileText, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@enlocal/react-hooks'

const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const TYPE_LABELS: Record<string, string> = {
  I: 'Ingreso',
  E: 'Egreso',
  P: 'Pago',
  T: 'Traslado',
}

interface InvoiceSummary {
  type: string
  status: string
  total: string
  tax: string
  subtotal: string
}

export default function InvoiceReportsPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [tab, setTab] = useState<'summary' | 'iva'>('summary')
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const from = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
        const { data } = await api.get('/api/invoices', {
          params: { source: 'cfdi', from, to, limit: '5000' },
        })
        setInvoices(data.data || data.items || [])
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchData()
  }, [month, year])

  // Compute summaries
  const stamped = invoices.filter((i: any) => i.status === 'stamped')
  const cancelled = invoices.filter((i: any) => i.status === 'cancelled')

  const byType = (type: string) => stamped.filter((i) => i.type === type)

  const sumTotal = (items: InvoiceSummary[]) => items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0)
  const sumTax = (items: InvoiceSummary[]) => items.reduce((s, i) => s + (parseFloat(i.tax) || 0), 0)
  const sumSubtotal = (items: InvoiceSummary[]) => items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0)

  const ingresoItems = byType('I')
  const egresoItems = byType('E')
  const pagoItems = byType('P')
  const trasladoItems = byType('T')

  // IVA calculations
  const ivaCobrado = sumTax(ingresoItems)
  const ivaCreditNotes = sumTax(egresoItems)
  const ivaNetoCobrado = ivaCobrado - ivaCreditNotes

  const typeRows = [
    { type: 'I', items: ingresoItems },
    { type: 'E', items: egresoItems },
    { type: 'P', items: pagoItems },
    { type: 'T', items: trasladoItems },
  ]

  const totalStamped = sumTotal(stamped)
  const totalCancelled = sumTotal(cancelled)

  return (
    <div>
      <button onClick={() => navigate('/invoicing')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a facturas
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reportes de Facturacion</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen mensual de CFDI emitidos e IVA</p>
      </div>

      {/* Period selector */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Mes</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClass}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ano</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button onClick={() => setTab('summary')} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} type="button">
          <BarChart3 className="mr-1.5 inline h-4 w-4" /> Resumen mensual
        </button>
        <button onClick={() => setTab('iva')} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${tab === 'iva' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} type="button">
          <DollarSign className="mr-1.5 inline h-4 w-4" /> Reporte de IVA
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : tab === 'summary' ? (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500"><FileText className="h-4 w-4" /> Total timbrados</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{stamped.length}</div>
              <div className="text-sm text-gray-600">{formatCurrency(totalStamped)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500"><TrendingUp className="h-4 w-4 text-green-500" /> Ingresos</div>
              <div className="mt-1 text-xl font-bold text-green-600">{ingresoItems.length}</div>
              <div className="text-sm text-gray-600">{formatCurrency(sumTotal(ingresoItems))}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500"><TrendingDown className="h-4 w-4 text-orange-500" /> Egresos</div>
              <div className="mt-1 text-xl font-bold text-orange-600">{egresoItems.length}</div>
              <div className="text-sm text-gray-600">{formatCurrency(sumTotal(egresoItems))}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs text-red-400">Cancelados</div>
              <div className="mt-1 text-xl font-bold text-red-600">{cancelled.length}</div>
              <div className="text-sm text-gray-600">{formatCurrency(totalCancelled)}</div>
            </div>
          </div>

          {/* By type table */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Desglose por tipo de CFDI</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Cantidad</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Subtotal</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">IVA</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {typeRows.map((row) => (
                    <tr key={row.type} className="border-b border-gray-100">
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          row.type === 'I' ? 'bg-green-100 text-green-700' :
                          row.type === 'E' ? 'bg-orange-100 text-orange-700' :
                          row.type === 'P' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {row.type}
                        </span>
                        <span className="ml-2 text-gray-700">{TYPE_LABELS[row.type] || row.type}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{row.items.length}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(sumSubtotal(row.items))}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(sumTax(row.items))}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(sumTotal(row.items))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">Total timbrados</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">{stamped.length}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">{formatCurrency(sumSubtotal(stamped))}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">{formatCurrency(sumTax(stamped))}</td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(totalStamped)}</td>
                  </tr>
                  {cancelled.length > 0 && (
                    <tr className="bg-red-50">
                      <td className="px-4 py-2 font-medium text-red-700">Cancelados</td>
                      <td className="px-4 py-2 text-right font-medium text-red-700">{cancelled.length}</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatCurrency(sumSubtotal(cancelled))}</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatCurrency(sumTax(cancelled))}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-700">{formatCurrency(totalCancelled)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net amounts */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Montos netos del periodo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Ingresos (I):</span>
                <span className="font-medium text-green-600">+ {formatCurrency(sumTotal(ingresoItems))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Egresos / NC (E):</span>
                <span className="font-medium text-orange-600">- {formatCurrency(sumTotal(egresoItems))}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                <span>Ingreso neto:</span>
                <span className="text-gray-900">{formatCurrency(sumTotal(ingresoItems) - sumTotal(egresoItems))}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* IVA Report tab */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="text-xs font-medium text-green-600">IVA cobrado (Ingresos)</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{formatCurrency(ivaCobrado)}</div>
              <div className="mt-1 text-xs text-green-600">De {ingresoItems.length} facturas tipo I</div>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="text-xs font-medium text-orange-600">IVA notas de credito (E)</div>
              <div className="mt-1 text-2xl font-bold text-orange-700">- {formatCurrency(ivaCreditNotes)}</div>
              <div className="mt-1 text-xs text-orange-600">De {egresoItems.length} notas de credito</div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-medium text-blue-600">IVA neto cobrado</div>
              <div className="mt-1 text-2xl font-bold text-blue-700">{formatCurrency(ivaNetoCobrado)}</div>
              <div className="mt-1 text-xs text-blue-600">Ingresos - Notas de credito</div>
            </div>
          </div>

          {/* IVA detail table */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Detalle de IVA por tipo</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 font-medium text-gray-600">Concepto</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Base gravable</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">IVA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-700">IVA cobrado (facturas de ingreso)</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(sumSubtotal(ingresoItems))}</td>
                    <td className="px-4 py-2 text-right font-medium text-green-600">{formatCurrency(ivaCobrado)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-700">IVA notas de credito</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(sumSubtotal(egresoItems))}</td>
                    <td className="px-4 py-2 text-right font-medium text-orange-600">- {formatCurrency(ivaCreditNotes)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-700">IVA neto a declarar</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-700">
                      {formatCurrency(sumSubtotal(ingresoItems) - sumSubtotal(egresoItems))}
                    </td>
                    <td className="px-4 py-2 text-right text-lg font-bold text-blue-700">{formatCurrency(ivaNetoCobrado)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs text-yellow-700">
              Este reporte es informativo y no sustituye la declaracion fiscal formal.
              Los montos de IVA acreditable (compras) no se incluyen aqui — consulte el modulo de cuentas por pagar si esta disponible.
              Para una declaracion completa, consulte a su contador.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
