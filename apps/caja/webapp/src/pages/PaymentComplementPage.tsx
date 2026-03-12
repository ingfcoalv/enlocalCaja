import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, FileText, Stamp, CreditCard, Search, AlertTriangle } from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useInvoiceStore } from '../stores/useInvoiceStore'
import { useSatCatalogStore } from '../stores/useSatCatalogStore'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50'
const btnOutline = 'flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0)
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return dateStr }
}

interface PpdInvoice {
  id: string
  series: string | null
  folio: number | null
  customerName: string | null
  customerRfc: string | null
  total: string
  uuidFiscal: string | null
  paymentMethod: string
  createdAt: string
}

interface PaymentDoc {
  invoiceId: string
  uuid: string
  folio: string
  saldoAnterior: number
  montoPagar: string
  saldoInsoluto: number
  parcialidad: number
}

export default function PaymentComplementPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { createComplementoPago, stamp } = useInvoiceStore()
  const { paymentForms, fetchPaymentForms } = useSatCatalogStore()

  const [ppdInvoices, setPpdInvoices] = useState<PpdInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Payment data
  const [selectedInvoices, setSelectedInvoices] = useState<PaymentDoc[]>([])
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentFormCode, setPaymentFormCode] = useState('03')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState('MXN')
  const [operationNumber, setOperationNumber] = useState('')
  const [sourceBank, setSourceBank] = useState('')

  const [saving, setSaving] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  useEffect(() => { fetchPaymentForms() }, [fetchPaymentForms])

  const fetchPpdInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/invoices', {
        params: { source: 'cfdi', status: 'stamped', limit: '100' },
      })
      const ppd = (data?.data || []).filter((inv: any) => inv.paymentMethod === 'PPD')
      setPpdInvoices(ppd)
    } catch {
      toast.error('Error al cargar facturas PPD')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchPpdInvoices() }, [fetchPpdInvoices])

  const filteredInvoices = ppdInvoices.filter((inv) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (inv.customerName?.toLowerCase().includes(q)) ||
           (inv.customerRfc?.toLowerCase().includes(q)) ||
           (inv.uuidFiscal?.toLowerCase().includes(q)) ||
           (`${inv.series || ''}${inv.folio || ''}`.toLowerCase().includes(q))
  })

  const addInvoiceToPayment = (inv: PpdInvoice) => {
    if (selectedInvoices.some((d) => d.invoiceId === inv.id)) return
    setSelectedInvoices([...selectedInvoices, {
      invoiceId: inv.id,
      uuid: inv.uuidFiscal || '',
      folio: `${inv.series || ''}${inv.folio || ''}`,
      saldoAnterior: parseFloat(inv.total),
      montoPagar: inv.total,
      saldoInsoluto: 0,
      parcialidad: 1,
    }])
  }

  const removeDoc = (invoiceId: string) => {
    setSelectedInvoices(selectedInvoices.filter((d) => d.invoiceId !== invoiceId))
  }

  const updateDoc = (invoiceId: string, montoPagar: string) => {
    setSelectedInvoices(selectedInvoices.map((d) => {
      if (d.invoiceId !== invoiceId) return d
      const monto = parseFloat(montoPagar) || 0
      return { ...d, montoPagar, saldoInsoluto: Math.max(0, d.saldoAnterior - monto) }
    }))
  }

  const totalDocPayments = selectedInvoices.reduce((sum, d) => sum + (parseFloat(d.montoPagar) || 0), 0)

  const handleGenerate = async (andStamp: boolean) => {
    if (selectedInvoices.length === 0) {
      toast.error('Seleccione al menos una factura PPD')
      return
    }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Ingrese el monto del pago')
      return
    }
    setSaving(true)
    try {
      const payload = {
        paymentDate,
        paymentForm: paymentFormCode,
        paymentAmount,
        paymentCurrency,
        operationNumber,
        sourceBank,
        series: 'CP',
        documents: selectedInvoices.map((d) => ({
          invoiceId: d.invoiceId,
          previousBalance: String(d.saldoAnterior),
          amountPaid: d.montoPagar,
          remainingBalance: String(d.saldoInsoluto),
          installment: d.parcialidad,
        })),
      }
      const created = await createComplementoPago(payload)
      if (andStamp) {
        setCreatedId(created.id)
        setShowStampModal(true)
      } else {
        toast.success('Complemento de pago creado')
        navigate(`/invoicing/${created.id}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear complemento')
    } finally {
      setSaving(false)
    }
  }

  const confirmStamp = async () => {
    if (!createdId) return
    setSaving(true)
    setShowStampModal(false)
    try {
      await stamp(createdId)
      toast.success('Complemento timbrado')
      navigate(`/invoicing/${createdId}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al timbrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button onClick={() => navigate('/invoicing')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a facturas
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Complemento de Pago</h1>
        <p className="mt-1 text-sm text-gray-500">Genera un CFDI tipo Pago (P) para facturas PPD</p>
      </div>

      {/* Payment data */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Datos del pago</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <div>
            <label className={labelClass}>Fecha de pago</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Forma de pago</label>
            <select value={paymentFormCode} onChange={(e) => setPaymentFormCode(e.target.value)} className={selectClass}>
              {paymentForms.length > 0 ? paymentForms.filter((f) => f.code !== '99').map((f) => (
                <option key={f.code} value={f.code}>{f.code} - {f.description}</option>
              )) : (
                <><option value="01">01 - Efectivo</option><option value="03">03 - Transferencia</option><option value="04">04 - Tarjeta credito</option></>
              )}
            </select>
          </div>
          <div>
            <label className={labelClass}>Monto total</label>
            <input type="number" step="0.01" min="0" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <select value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value)} className={selectClass}>
              <option value="MXN">MXN</option><option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>No. operacion</label>
            <input type="text" value={operationNumber} onChange={(e) => setOperationNumber(e.target.value)} className={inputClass} placeholder="Referencia" />
          </div>
          <div>
            <label className={labelClass}>Banco origen</label>
            <input type="text" value={sourceBank} onChange={(e) => setSourceBank(e.target.value)} className={inputClass} placeholder="Nombre banco" />
          </div>
        </div>
      </div>

      {/* Search PPD invoices */}
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Facturas PPD timbradas</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar por folio, cliente o UUID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none" />
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
              <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="px-4 py-3 font-medium text-gray-600">UUID</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center"><CreditCard className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-sm text-gray-500">No hay facturas PPD timbradas</p></td></tr>
            ) : filteredInvoices.map((inv) => (
              <tr key={inv.id} className={`border-b border-gray-100 ${selectedInvoices.some((d) => d.invoiceId === inv.id) ? 'bg-primary-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.series || ''}{inv.folio || inv.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-gray-700">{inv.customerName || 'Sin cliente'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.uuidFiscal?.slice(0, 13) || '-'}...</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
                <td className="px-4 py-3">
                  {selectedInvoices.some((d) => d.invoiceId === inv.id) ? (
                    <button onClick={() => removeDoc(inv.id)} className="text-xs text-red-500 hover:text-red-700" type="button">Quitar</button>
                  ) : (
                    <button onClick={() => addInvoiceToPayment(inv)} className="text-xs text-primary-600 hover:text-primary-800 font-medium" type="button">Agregar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected documents */}
      {selectedInvoices.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Documentos relacionados ({selectedInvoices.length})</h3>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 font-medium text-gray-600">Folio</th>
                  <th className="px-3 py-2 font-medium text-gray-600">UUID</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Saldo anterior</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Monto a pagar</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Saldo insoluto</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Parcialidad</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoices.map((doc) => (
                  <tr key={doc.invoiceId} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs">{doc.folio}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{doc.uuid.slice(0, 13)}...</td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(doc.saldoAnterior)}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" min="0" value={doc.montoPagar} onChange={(e) => updateDoc(doc.invoiceId, e.target.value)}
                        className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(doc.saldoInsoluto)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{doc.parcialidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-gray-500">Suma de pagos: <span className="font-bold text-gray-900">{formatCurrency(totalDocPayments)}</span></span>
            {paymentAmount && Math.abs(totalDocPayments - parseFloat(paymentAmount)) > 0.01 && (
              <span className="text-yellow-600 font-medium">Diferencia: {formatCurrency(totalDocPayments - parseFloat(paymentAmount))}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedInvoices.length > 0 && (
        <div className="flex justify-end gap-3">
          <button onClick={() => handleGenerate(false)} disabled={saving} className={btnOutline} type="button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Guardar borrador
          </button>
          <button onClick={() => handleGenerate(true)} disabled={saving} className={btnPrimary} type="button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Generar y timbrar
          </button>
        </div>
      )}

      {/* Stamp modal */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar timbrado</h3>
            </div>
            <p className="mb-4 text-sm text-gray-600">Se timbrara el complemento de pago por {formatCurrency(paymentAmount)}.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowStampModal(false); if (createdId) navigate(`/invoicing/${createdId}`) }} className={btnOutline} type="button">Cancelar</button>
              <button onClick={confirmStamp} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
