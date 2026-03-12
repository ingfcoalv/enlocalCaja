import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Package,
  X,
} from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useQuoteStore } from '../stores/useQuoteStore'

const fmtMXN = (value: string | number) =>
  Number(value).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  })

export default function QuoteTemplatesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { templates, loading, fetchTemplates, fromTemplate } = useQuoteStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const openModal = (templateId: string) => {
    setSelectedId(templateId)
    setCustomerName('')
    setCustomerId('')
  }

  const closeModal = () => {
    if (submitting) return
    setSelectedId(null)
    setCustomerName('')
    setCustomerId('')
  }

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('El nombre del cliente es requerido')
      return
    }
    if (!selectedId) return

    setSubmitting(true)
    try {
      const payload: { customer_name: string; customer_id?: string } = {
        customer_name: customerName.trim(),
      }
      if (customerId.trim()) {
        payload.customer_id = customerId.trim()
      }
      const newQuote = await fromTemplate(selectedId, payload)
      toast.success('Cotizacion creada desde plantilla')
      navigate(`/quotes/${newQuote.id}`)
    } catch {
      toast.error('Error al crear cotizacion desde plantilla')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/quotes"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a cotizaciones
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de Cotizacion</h1>
          <p className="mt-1 text-sm text-gray-500">
            {templates.length} plantilla{templates.length !== 1 ? 's' : ''} disponible{templates.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading && templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">Cargando plantillas...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 shadow-sm">
          <FileText className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">No hay plantillas</p>
          <p className="mt-1 text-sm text-gray-500">
            Crea una cotizacion y marcala como plantilla para empezar.
          </p>
          <Link
            to="/quotes"
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Ir a cotizaciones
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm p-6"
            >
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {tpl.templateName || 'Sin nombre'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Cliente: <span className="text-gray-400 italic">por asignar</span>
                </p>
              </div>

              <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4 text-gray-400" />
                  {tpl.items?.length ?? 0} articulo{(tpl.items?.length ?? 0) !== 1 ? 's' : ''}
                </span>
                <span className="font-medium text-gray-900">
                  {fmtMXN(tpl.total)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => openModal(tpl.id)}
                className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Usar plantilla
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Datos del cliente
              </h3>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label htmlFor="tpl-customer-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre del cliente *
                </label>
                <input
                  id="tpl-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Nombre o razon social"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="tpl-customer-id" className="mb-1 block text-sm font-medium text-gray-700">
                  ID de cliente <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  id="tpl-customer-id"
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Buscar o ingresar ID"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear cotizacion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
