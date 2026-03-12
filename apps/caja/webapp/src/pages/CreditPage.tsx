import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, Landmark, ArrowLeft, Banknote } from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import AbonoModal from '../components/AbonoModal'

interface CreditCustomer {
  id: string
  name: string
  creditLimit: number
  totalOutstanding: number
  available: number
  invoiceCount: number
}

interface CreditInvoice {
  id: string
  folio: number | null
  total: number
  totalPaid: number
  balance: number
  status: string
  createdAt: string
}

interface CustomerDetail {
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
    creditLimit: number
    totalOutstanding: number
    available: number
  }
  invoices: CreditInvoice[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return dateStr }
}

export default function CreditPage() {
  const toast = useToast()
  const [customers, setCustomers] = useState<CreditCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [abonoInvoice, setAbonoInvoice] = useState<CreditInvoice | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/credit/customers', {
        params: { q: searchQuery || undefined },
      })
      setCustomers(data?.data || [])
    } catch {
      toast.error('Error al cargar clientes con credito')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, toast])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const fetchCustomerDetail = async (customerId: string) => {
    setLoadingDetail(true)
    try {
      const { data } = await api.get(`/api/credit/customers/${customerId}`)
      setSelectedCustomer(data)
    } catch {
      toast.error('Error al cargar detalle del cliente')
    } finally {
      setLoadingDetail(false)
    }
  }

  const totalOutstanding = customers.reduce((sum, c) => sum + c.totalOutstanding, 0)

  const handleAbonoSuccess = () => {
    setAbonoInvoice(null)
    if (selectedCustomer) {
      fetchCustomerDetail(selectedCustomer.customer.id)
    }
    fetchCustomers()
  }

  // Detail view
  if (selectedCustomer) {
    const { customer, invoices } = selectedCustomer
    return (
      <div>
        <button
          onClick={() => setSelectedCustomer(null)}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {customer.phone && `Tel: ${customer.phone}`}
            {customer.email && ` | ${customer.email}`}
          </p>
        </div>

        {/* Credit summary cards */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Limite de credito</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(customer.creditLimit)}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-600">Saldo pendiente</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(customer.totalOutstanding)}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs text-green-600">Disponible</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(customer.available)}</p>
          </div>
        </div>

        {/* Credit invoices */}
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Facturas con saldo</h2>
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Pagado</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Saldo</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Accion</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      Sin facturas con saldo pendiente
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.folio || inv.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(inv.totalPaid)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(inv.balance)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setAbonoInvoice(inv)}
                          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                          type="button"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          Abonar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Abono Modal */}
        {abonoInvoice && (
          <AbonoModal
            invoiceId={abonoInvoice.id}
            customerId={customer.id}
            invoiceFolio={String(abonoInvoice.folio || abonoInvoice.id.slice(0, 8))}
            invoiceTotal={abonoInvoice.total}
            totalPaid={abonoInvoice.totalPaid}
            balance={abonoInvoice.balance}
            onClose={() => setAbonoInvoice(null)}
            onSuccess={handleAbonoSuccess}
          />
        )}
      </div>
    )
  }

  // Main list view
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Creditos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestion de creditos y abonos de clientes
        </p>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary-600" />
          <span className="text-sm text-gray-500">Total pendiente:</span>
          <span className="text-lg font-bold text-red-600">{formatCurrency(totalOutstanding)}</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{customers.length}</span> clientes con credito
        </span>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Limite</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Saldo</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Disponible</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Facturas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Landmark className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No hay clientes con credito pendiente</p>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  onClick={() => fetchCustomerDetail(customer.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(customer.creditLimit)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(customer.totalOutstanding)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatCurrency(customer.available)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{customer.invoiceCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
