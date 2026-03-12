import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, FileText, Stamp, Search, AlertTriangle, FileX } from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useInvoiceStore } from '../stores/useInvoiceStore'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50'
const btnOutline = 'flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0)
}

interface OriginalInvoice {
  id: string
  series: string | null
  folio: number | null
  customerName: string | null
  customerRfc: string | null
  customerId: string | null
  uuidFiscal: string | null
  total: string
  subtotal: string
  tax: string
  useCfdi: string | null
  paymentForm: string | null
  items: any[]
}

interface CreditItem {
  itemId: string
  description: string
  quantity: string
  maxQuantity: number
  unitPrice: string
  satCode: string
  satUnit: string
  taxRate: string
  selected: boolean
}

export default function CreditNotePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { create, stamp } = useInvoiceStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [originalInvoice, setOriginalInvoice] = useState<OriginalInvoice | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [motivo, setMotivo] = useState('')
  const [creditItems, setCreditItems] = useState<CreditItem[]>([])

  const [saving, setSaving] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // Search for stamped invoices
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setLoadingSearch(true)
      try {
        const { data } = await api.get('/api/invoices', {
          params: { source: 'cfdi', status: 'stamped', type: 'I', q: searchQuery, limit: '10' },
        })
        setSearchResults(data?.data || [])
      } catch { /* ignore */ }
      finally { setLoadingSearch(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const selectOriginal = async (inv: any) => {
    setLoadingDetail(true)
    setSearchResults([])
    setSearchQuery(`${inv.series || ''}${inv.folio || ''} - ${inv.customerName || ''}`)
    try {
      const { data } = await api.get(`/api/invoices/${inv.id}`)
      const detail = data.data || data
      setOriginalInvoice(detail)
      setCreditItems((detail.items || []).map((item: any) => ({
        itemId: item.id,
        description: item.description,
        quantity: String(item.quantity),
        maxQuantity: parseFloat(item.quantity),
        unitPrice: String(item.unitPrice),
        satCode: item.satCode || '01010101',
        satUnit: item.satUnit || 'H87',
        taxRate: String(item.taxRate || '0.16'),
        selected: true,
      })))
    } catch {
      toast.error('Error al cargar factura original')
    } finally {
      setLoadingDetail(false)
    }
  }

  const toggleItem = (itemId: string) => {
    setCreditItems(creditItems.map((i) => i.itemId === itemId ? { ...i, selected: !i.selected } : i))
  }

  const updateItemQty = (itemId: string, qty: string) => {
    setCreditItems(creditItems.map((i) => i.itemId === itemId ? { ...i, quantity: qty } : i))
  }

  const selectedItems = creditItems.filter((i) => i.selected)
  const creditSubtotal = selectedItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)
  const creditTax = selectedItems.reduce((sum, i) => {
    const amount = (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0)
    return sum + amount * (parseFloat(i.taxRate) || 0)
  }, 0)
  const creditTotal = creditSubtotal + creditTax

  const handleGenerate = async (andStamp: boolean) => {
    if (!originalInvoice || selectedItems.length === 0) return
    if (!motivo) { toast.error('Ingrese el motivo de la nota de credito'); return }
    setSaving(true)
    try {
      const payload = {
        customerId: originalInvoice.customerId,
        series: 'NC',
        type: 'E',
        useCfdi: originalInvoice.useCfdi || 'G02',
        paymentMethod: 'PUE',
        paymentForm: originalInvoice.paymentForm || '01',
        currency: 'MXN',
        notes: motivo,
        items: selectedItems.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          satCode: i.satCode,
          satUnit: i.satUnit,
          taxRate: i.taxRate,
        })),
        relations: [{
          relationType: '01',
          relatedUuid: originalInvoice.uuidFiscal,
        }],
      }
      const { data } = await api.post('/api/invoices', payload)
      const created = data.data || data
      if (andStamp) {
        setCreatedId(created.id)
        setShowStampModal(true)
      } else {
        toast.success('Nota de credito creada como borrador')
        navigate(`/invoicing/${created.id}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear nota de credito')
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
      toast.success('Nota de credito timbrada')
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
        <h1 className="text-2xl font-bold text-gray-900">Nota de Credito</h1>
        <p className="mt-1 text-sm text-gray-500">Genera un CFDI tipo Egreso (E) relacionado a una factura existente</p>
      </div>

      {/* Search original invoice */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Factura original</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar factura timbrada por folio, cliente o UUID..." value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setOriginalInvoice(null) }}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          {searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
              {searchResults.map((inv: any) => (
                <button key={inv.id} onClick={() => selectOriginal(inv)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" type="button">
                  <span className="font-mono font-medium">{inv.series || ''}{inv.folio || ''}</span>
                  <span className="ml-2 text-gray-700">{inv.customerName || 'Sin cliente'}</span>
                  <span className="ml-2 text-xs text-gray-500">{formatCurrency(inv.total)}</span>
                </button>
              ))}
            </div>
          )}
          {loadingSearch && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
        </div>
      </div>

      {loadingDetail && (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      )}

      {originalInvoice && (
        <>
          {/* Original invoice summary */}
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-700">Factura original</h3>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div><span className="text-blue-600">Folio:</span> <span className="font-medium">{originalInvoice.series}{originalInvoice.folio}</span></div>
              <div><span className="text-blue-600">UUID:</span> <span className="font-mono text-xs">{originalInvoice.uuidFiscal?.slice(0, 13)}...</span></div>
              <div><span className="text-blue-600">Cliente:</span> <span className="font-medium">{originalInvoice.customerName}</span></div>
              <div><span className="text-blue-600">Total:</span> <span className="font-bold">{formatCurrency(originalInvoice.total)}</span></div>
            </div>
          </div>

          {/* Motivo */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <label className={labelClass}>Motivo de la nota de credito</label>
            <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputClass} placeholder="Ej: Descuento por pronto pago, Devolucion de mercancia..." />
          </div>

          {/* Select items to credit */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Conceptos a acreditar</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2 font-medium text-gray-600">Descripcion</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Clave SAT</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Cant. original</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Cant. a acreditar</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">P.U.</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {creditItems.map((item) => (
                    <tr key={item.itemId} className={`border-b border-gray-100 ${item.selected ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={item.selected} onChange={() => toggleItem(item.itemId)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-gray-700">{item.description}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.satCode}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{item.maxQuantity}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" min="0" max={item.maxQuantity} value={item.quantity} onChange={(e) => updateItemQty(item.itemId, e.target.value)}
                          disabled={!item.selected} className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none disabled:bg-gray-100" />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {item.selected ? formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal nota de credito:</span><span className="font-medium">{formatCurrency(creditSubtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">IVA:</span><span className="font-medium">{formatCurrency(creditTax)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 text-lg font-bold">
                <span>Total nota de credito:</span><span className="text-orange-600">{formatCurrency(creditTotal)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={() => handleGenerate(false)} disabled={saving || selectedItems.length === 0} className={btnOutline} type="button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Guardar borrador
            </button>
            <button onClick={() => handleGenerate(true)} disabled={saving || selectedItems.length === 0} className={btnPrimary} type="button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Generar y timbrar
            </button>
          </div>
        </>
      )}

      {/* Stamp modal */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar timbrado</h3>
            </div>
            <p className="mb-4 text-sm text-gray-600">Se timbrara una nota de credito por {formatCurrency(creditTotal)} relacionada al UUID {originalInvoice?.uuidFiscal?.slice(0, 13)}...</p>
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
