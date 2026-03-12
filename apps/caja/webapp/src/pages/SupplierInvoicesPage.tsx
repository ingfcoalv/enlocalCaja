import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  FileText, Loader2, ChevronLeft, ChevronRight, X, Plus, Search, Trash2, Link2, Upload,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useSupplierInvoiceStore, type SupplierInvoice } from '../stores/useSupplierInvoiceStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />Pendiente</span>
  if (status === 'posted') return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Aplicada</span>
  if (status === 'cancelled') return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-600" />Cancelada</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{status}</span>
}

export default function SupplierInvoicesPage() {
  const toast = useToast()
  const { invoices, loading, pagination, fetchInvoices } = useSupplierInvoiceStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const totalAmount = invoices.reduce((s, inv) => s + parseFloat(inv.total), 0)

  const load = useCallback(() => {
    const filters: any = {
      status: statusFilter || undefined,
      page,
      limit: 20,
    }
    if (typeFilter === 'PPD') {
      filters.payment_method = 'PPD'
      filters.type = 'I'
    } else if (typeFilter) {
      filters.type = typeFilter
    }
    fetchInvoices(filters)
  }, [fetchInvoices, statusFilter, typeFilter, page])

  useEffect(() => { load() }, [load])

  const handleRowClick = async (invoice: SupplierInvoice) => {
    try {
      const { data } = await api.get(`/api/supplier-invoices/${invoice.id}`)
      setSelectedInvoice(data.data || data)
    } catch { setSelectedInvoice(invoice) }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-gray-500" />
              <h1 className="text-2xl font-bold text-gray-900">Facturas de Proveedor</h1>
            </div>
            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-gray-600">Total: <span className="font-bold text-gray-900">{fmtMoney(totalAmount)}</span></span>
              <span className="text-gray-500">{pagination.total} facturas</span>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Nueva factura
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Todos los status</option>
          <option value="pending">Pendiente</option>
          <option value="posted">Aplicada</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Todos los tipos</option>
          <option value="I">Ingreso</option>
          <option value="E">Egreso / NC</option>
          <option value="P">Complemento (P)</option>
          <option value="PPD">PPD pendientes</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay facturas de proveedor</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Factura</th>
                <th className="px-4 py-3 font-medium text-gray-600">Proveedor</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => handleRowClick(inv)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.supplierName || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.type === 'I' ? 'bg-blue-100 text-blue-700' : inv.type === 'P' ? 'bg-teal-100 text-teal-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {inv.type === 'I' ? 'Ingreso' : inv.type === 'P' ? 'Complemento' : 'Egreso'}
                      </span>
                      {inv.paymentMethod === 'PPD' && inv.type === 'I' && (() => {
                        const complemented = parseFloat(inv.amountComplemented || '0')
                        const total = parseFloat(inv.total)
                        const pct = total > 0 ? Math.min(100, Math.round((complemented / total) * 100)) : 0
                        return (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 rounded-full bg-gray-200">
                              <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-500">{pct}%</span>
                          </div>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(inv.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(inv.issueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>Pagina {pagination.page} de {pagination.pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRefresh={() => { load(); setSelectedInvoice(null) }}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

function InvoiceDetail({ invoice, onClose, onRefresh }: {
  invoice: SupplierInvoice; onClose: () => void; onRefresh: () => void
}) {
  const toast = useToast()
  const [showComplementModal, setShowComplementModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const isPPD = invoice.paymentMethod === 'PPD' && invoice.type === 'I'
  const hasPdf = invoice.notes?.includes('[PDF adjunto:')

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('pdf', file)
      await api.post(`/api/supplier-invoices/${invoice.id}/upload-pdf`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('PDF adjuntado exitosamente')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al subir PDF')
    } finally {
      setUploading(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/api/supplier-invoices/${invoice.id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${invoice.invoiceNumber || invoice.id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF no encontrado')
    }
  }

  const complemented = parseFloat(invoice.amountComplemented || '0')
  const total = parseFloat(invoice.total)
  const remaining = Math.max(0, total - complemented)
  const pct = total > 0 ? Math.min(100, Math.round((complemented / total) * 100)) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Detalle Factura — {invoice.invoiceNumber || 'N/A'}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Proveedor</p>
              <p className="font-medium text-gray-900">{invoice.supplierName || invoice.supplier?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <StatusBadge status={invoice.status} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Tipo</p>
              <p className="font-medium text-gray-900">{invoice.type === 'I' ? 'Ingreso' : invoice.type === 'P' ? 'Complemento' : 'Egreso / NC'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha emision</p>
              <p className="font-medium text-gray-900">{fmtDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(invoice.total)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Subtotal</p>
              <p className="text-sm text-gray-700">{fmtMoney(invoice.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">IVA</p>
              <p className="text-sm text-gray-700">{fmtMoney(invoice.taxAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">UUID CFDI</p>
              <p className="text-sm text-gray-700 break-all">{invoice.invoiceUuid || '—'}</p>
            </div>
          </div>
          {invoice.paymentMethod && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Metodo de pago</p>
                <p className="text-sm text-gray-700">{invoice.paymentMethod}</p>
              </div>
              {invoice.paymentForm && (
                <div>
                  <p className="text-xs text-gray-500">Forma de pago</p>
                  <p className="text-sm text-gray-700">{invoice.paymentForm}</p>
                </div>
              )}
            </div>
          )}
          {invoice.notes && (
            <div>
              <p className="text-xs text-gray-500">Notas</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}

          {/* PPD Complement Progress Section */}
          {isPPD && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-900">Complementos de Pago (PPD)</h3>
                {pct < 100 && (
                  <button
                    onClick={() => setShowComplementModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Registrar complemento
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-blue-600">Total factura</p>
                  <p className="font-semibold text-blue-900">{fmtMoney(total)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Complementado</p>
                  <p className="font-semibold text-green-700">{fmtMoney(complemented)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Restante</p>
                  <p className="font-semibold text-orange-700">{fmtMoney(remaining)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 rounded-full bg-blue-200">
                  <div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs font-bold ${pct >= 100 ? 'text-green-700' : 'text-blue-700'}`}>{pct}%</span>
              </div>

              {/* Complements table */}
              {invoice.complements && invoice.complements.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 border-b border-blue-200">
                        <th className="px-3 py-2 text-left font-medium text-blue-700">Folio</th>
                        <th className="px-3 py-2 text-left font-medium text-blue-700">Fecha</th>
                        <th className="px-3 py-2 text-right font-medium text-blue-700">Monto</th>
                        <th className="px-3 py-2 text-left font-medium text-blue-700">UUID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.complements.map((c: any) => (
                        <tr key={c.id} className="border-b border-blue-100">
                          <td className="px-3 py-2 text-gray-900">{c.invoiceNumber || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{fmtDate(c.issueDate)}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtMoney(c.total)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 break-all">{c.invoiceUuid || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(!invoice.complements || invoice.complements.length === 0) && (
                <p className="text-xs text-blue-600 italic">No se han registrado complementos aun.</p>
              )}
            </div>
          )}

          {/* Items list */}
          {invoice.items && invoice.items.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Partidas</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">P.Unit</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{item.description || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtMoney(item.unitCost || item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtMoney(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleUploadPdf}
            />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {hasPdf ? 'Resubir PDF' : 'Adjuntar PDF'}
            </button>
            {hasPdf && (
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" /> Ver PDF
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>

      {/* Register Complement Modal */}
      {showComplementModal && (
        <RegisterComplementModal
          parentInvoice={invoice}
          onClose={() => setShowComplementModal(false)}
          onSuccess={() => { setShowComplementModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}

function RegisterComplementModal({ parentInvoice, onClose, onSuccess }: {
  parentInvoice: SupplierInvoice; onClose: () => void; onSuccess: () => void
}) {
  const toast = useToast()
  const { create: createInvoice } = useSupplierInvoiceStore()
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceUuid, setInvoiceUuid] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [complementAmount, setComplementAmount] = useState(0)
  const [paymentForm, setPaymentForm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [parsingXml, setParsingXml] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parentTotal = parseFloat(parentInvoice.total)
  const parentComplemented = parseFloat(parentInvoice.amountComplemented || '0')
  const remaining = Math.max(0, parentTotal - parentComplemented)

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsingXml(true)
    try {
      const xmlContent = await file.text()
      const { data: parsed } = await api.post('/api/supplier-invoices/parse-xml', { xml_content: xmlContent })
      const d = parsed.data || parsed

      if (d.type !== 'P') {
        toast.warning('El XML no es un complemento de pago (tipo P)')
        return
      }

      if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber)
      if (d.invoiceUuid) setInvoiceUuid(d.invoiceUuid)
      if (d.issueDate) setDate(d.issueDate)
      if (d.complementAmount) setComplementAmount(d.complementAmount)
      if (d.paymentForm) setPaymentForm(d.paymentForm)

      toast.success(`XML complemento leido: ${fmtMoney(d.complementAmount || 0)}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al leer XML')
    } finally {
      setParsingXml(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!invoiceNumber) return toast.warning('Ingresa el numero de factura del complemento')
    if (complementAmount <= 0) return toast.warning('El monto debe ser mayor a 0')
    setSubmitting(true)
    try {
      await createInvoice({
        supplier_id: parentInvoice.supplierId,
        invoice_number: invoiceNumber,
        invoice_uuid: invoiceUuid || undefined,
        issue_date: date,
        type: 'P',
        parent_invoice_id: parentInvoice.id,
        complement_amount: complementAmount,
        payment_form: paymentForm || undefined,
        items: [],
      })
      toast.success('Complemento registrado exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al registrar complemento')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Registrar Complemento de Pago</h2>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".xml" onChange={handleXmlUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingXml}
              className="flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
            >
              {parsingXml ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Cargar XML
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-600">Factura padre</p>
            <p className="font-medium text-blue-900">{parentInvoice.invoiceNumber} — {fmtMoney(parentTotal)}</p>
            <p className="text-xs text-blue-700">Complementado: {fmtMoney(parentComplemented)} | Restante: {fmtMoney(remaining)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">No. Factura complemento *</label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} placeholder="P-001" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">UUID CFDI</label>
              <input type="text" value={invoiceUuid} onChange={(e) => setInvoiceUuid(e.target.value)} className={inputClass} placeholder="abc123-..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha del pago *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto del pago *</label>
              <input
                type="number" min="0.01" step="0.01" max={remaining}
                value={complementAmount || ''}
                onChange={(e) => setComplementAmount(parseFloat(e.target.value) || 0)}
                className={inputClass}
                placeholder={`Max: ${remaining.toFixed(2)}`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Forma de pago</label>
            <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} className={inputClass}>
              <option value="">Seleccionar...</option>
              <option value="01">01 - Efectivo</option>
              <option value="02">02 - Cheque</option>
              <option value="03">03 - Transferencia</option>
              <option value="04">04 - Tarjeta de credito</option>
              <option value="28">28 - Tarjeta de debito</option>
              <option value="99">99 - Por definir</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar complemento
          </button>
        </div>
      </div>
    </div>
  )
}

interface InvoiceLineItem {
  description: string
  quantity: number
  unit_cost: number
  discount: number
}

function CreateInvoiceModal({ onClose, onSuccess }: {
  onClose: () => void; onSuccess: () => void
}) {
  const toast = useToast()
  const { create: createInvoice } = useSupplierInvoiceStore()

  // Supplier search
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierResults, setSupplierResults] = useState<any[]>([])
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const searchTimeout = useRef<any>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceUuid, setInvoiceUuid] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState<'I' | 'E'>('I')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentForm, setPaymentForm] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceLineItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Link to PO
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [selectedPoId, setSelectedPoId] = useState('')

  // Link to existing CxP
  const [payables, setPayables] = useState<any[]>([])
  const [selectedPayableId, setSelectedPayableId] = useState('')

  // XML upload
  const [parsingXml, setParsingXml] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsingXml(true)
    try {
      const xmlContent = await file.text()
      const { data: parsed } = await api.post('/api/supplier-invoices/parse-xml', { xml_content: xmlContent })
      const d = parsed.data || parsed

      // Auto-fill form fields
      if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber)
      if (d.invoiceUuid) setInvoiceUuid(d.invoiceUuid)
      if (d.issueDate) setDate(d.issueDate)
      if (d.type) setType(d.type)
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod)
      if (d.paymentForm) setPaymentForm(d.paymentForm)
      if (d.notes) setNotes(d.notes)

      // Auto-fill items
      if (d.items && d.items.length > 0) {
        setItems(d.items.map((it: any) => ({
          description: it.description || '',
          quantity: it.quantity || 1,
          unit_cost: it.unit_cost || 0,
          discount: it.discount || 0,
        })))
      }

      // Auto-select supplier if matched by RFC
      if (d.matchedSupplier) {
        setSupplierId(d.matchedSupplier.id)
        setSupplierName(d.matchedSupplier.name)
        setSupplierQuery(d.matchedSupplier.name)
      } else if (d.emisor?.nombre) {
        // Set query to emisor name so user can see who it is
        setSupplierQuery(d.emisor.nombre + (d.emisor.rfc ? ` (RFC: ${d.emisor.rfc})` : ''))
      }

      toast.success(`XML leído: ${d.invoiceNumber || 'factura'} — ${d.emisor?.nombre || 'emisor'}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al leer XML')
    } finally {
      setParsingXml(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Fetch POs for selected supplier
  useEffect(() => {
    if (!supplierId) { setPurchaseOrders([]); setPayables([]); return }
    api.get('/api/purchase-orders', { params: { supplier_id: supplierId, limit: 50 } })
      .then(({ data }) => setPurchaseOrders(data.data || []))
      .catch(() => {})
    api.get('/api/payables', { params: { supplier_id: supplierId, status: 'current', limit: 50 } })
      .then(({ data }) => setPayables(data.data || []))
      .catch(() => {})
  }, [supplierId])

  const searchSuppliers = (q: string) => {
    setSupplierQuery(q)
    setSupplierId('')
    setSupplierName('')
    setSelectedPoId('')
    setSelectedPayableId('')
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.length < 2) { setSupplierResults([]); setShowSupplierDropdown(false); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/suppliers', { params: { q, limit: 10 } })
        setSupplierResults(data.data || [])
        setShowSupplierDropdown(true)
      } catch { setSupplierResults([]) }
    }, 300)
  }

  const selectSupplier = (s: any) => {
    setSupplierId(s.id)
    setSupplierName(s.name)
    setSupplierQuery(s.name)
    setShowSupplierDropdown(false)
  }

  // Item management
  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_cost: 0, discount: 0 }])
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: keyof InvoiceLineItem, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  const lineTotal = (item: InvoiceLineItem) => item.quantity * item.unit_cost - item.discount
  const grandSubtotal = items.reduce((s, i) => s + lineTotal(i), 0)
  const grandTax = grandSubtotal * 0.16
  const grandTotal = grandSubtotal + grandTax

  const handleSubmit = async () => {
    if (!supplierId) return toast.warning('Selecciona un proveedor')
    if (!invoiceNumber) return toast.warning('Ingresa el numero de factura')
    setSubmitting(true)
    try {
      const payload: any = {
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        invoice_uuid: invoiceUuid || undefined,
        issue_date: date,
        type,
        payment_method: paymentMethod || undefined,
        payment_form: paymentForm || undefined,
        notes: notes || undefined,
      }
      if (selectedPoId) payload.purchase_order_id = selectedPoId
      if (selectedPayableId) payload.payable_id = selectedPayableId
      if (items.length > 0) {
        payload.items = items.filter((i) => i.description).map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          discount: i.discount,
        }))
      }
      await createInvoice(payload)
      toast.success('Factura registrada exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear factura')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Factura de Proveedor</h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleXmlUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingXml}
              className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {parsingXml ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Cargar XML
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Supplier search */}
          <div ref={dropdownRef} className="relative">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Proveedor *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={supplierQuery}
                onChange={(e) => searchSuppliers(e.target.value)}
                onFocus={() => { if (supplierResults.length > 0) setShowSupplierDropdown(true) }}
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Buscar proveedor por nombre..."
              />
            </div>
            {supplierId && <p className="mt-1 text-xs text-green-600">Seleccionado: {supplierName}</p>}
            {showSupplierDropdown && supplierResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                {supplierResults.map((s) => (
                  <button key={s.id} type="button" onClick={() => selectSupplier(s)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    {s.rfc && <span className="ml-2 text-xs text-gray-500">RFC: {s.rfc}</span>}
                  </button>
                ))}
              </div>
            )}
            {showSupplierDropdown && supplierQuery.length >= 2 && supplierResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm text-gray-500">No se encontraron proveedores</div>
            )}
          </div>

          {/* Invoice number + UUID + Date */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">No. Factura *</label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} placeholder="A-1234" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">UUID CFDI</label>
              <input type="text" value={invoiceUuid} onChange={(e) => setInvoiceUuid(e.target.value)} className={inputClass} placeholder="abc123-def456-..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha emision *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Type + Payment method + Payment form */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'I' | 'E')} className={inputClass}>
                <option value="I">Ingreso (factura)</option>
                <option value="E">Egreso (nota de credito)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Metodo de pago</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                <option value="">Seleccionar...</option>
                <option value="PUE">PUE - Pago en una exhibicion</option>
                <option value="PPD">PPD - Pago en parcialidades</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Forma de pago</label>
              <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} className={inputClass}>
                <option value="">Seleccionar...</option>
                <option value="01">01 - Efectivo</option>
                <option value="02">02 - Cheque</option>
                <option value="03">03 - Transferencia</option>
                <option value="04">04 - Tarjeta de credito</option>
                <option value="28">28 - Tarjeta de debito</option>
                <option value="99">99 - Por definir</option>
              </select>
            </div>
          </div>

          {/* Link to PO */}
          {supplierId && purchaseOrders.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                <Link2 className="mr-1 inline h-3.5 w-3.5" />
                Vincular a Orden de Compra
              </label>
              <select value={selectedPoId} onChange={(e) => setSelectedPoId(e.target.value)} className={inputClass}>
                <option value="">Sin vincular (opcional)</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>OC-{String(po.folio).padStart(4, '0')} — {fmtMoney(po.total)} — {po.status}</option>
                ))}
              </select>
            </div>
          )}

          {/* Link to existing CxP */}
          {supplierId && payables.length > 0 && type === 'I' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                <Link2 className="mr-1 inline h-3.5 w-3.5" />
                Vincular a CxP existente
              </label>
              <select value={selectedPayableId} onChange={(e) => setSelectedPayableId(e.target.value)} className={inputClass}>
                <option value="">Crear nueva CxP (default)</option>
                {payables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.supplierName || 'CxP'} — Saldo: {fmtMoney(p.balance)} — Vence: {fmtDate(p.dueDate)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Si vinculas a una CxP existente, la factura se asociara sin crear una nueva cuenta
              </p>
            </div>
          )}

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Partidas / Conceptos</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Plus className="h-3.5 w-3.5" /> Agregar partida
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400">
                Sin partidas. El total se calculara de las partidas agregadas.
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">P.Unit</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">Desc.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Subtotal</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="Descripcion del concepto"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="1" step="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0" step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0" step="0.01"
                            value={item.discount}
                            onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{fmtMoney(lineTotal(item))}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeItem(idx)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-gray-500">Subtotal</td>
                        <td className="px-3 py-1.5 text-right text-sm text-gray-700">{fmtMoney(grandSubtotal)}</td>
                        <td />
                      </tr>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-gray-500">IVA 16%</td>
                        <td className="px-3 py-1.5 text-right text-sm text-gray-700">{fmtMoney(grandTax)}</td>
                        <td />
                      </tr>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">{fmtMoney(grandTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Observaciones sobre la factura..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar factura
          </button>
        </div>
      </div>
    </div>
  )
}
