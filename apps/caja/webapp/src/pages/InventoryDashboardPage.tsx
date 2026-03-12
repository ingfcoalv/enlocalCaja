import { useEffect, useState, useCallback } from 'react'
import {
  Package,
  DollarSign,
  AlertTriangle,
  ArrowLeftRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useInventoryStore, Article } from '../stores/useInventoryStore'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

const formatCurrency = (val: number | string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val))

const emptyArticle: Partial<Article> = {
  name: '',
  unit: 'pz',
  current_stock: 0,
  min_stock: 0,
  cost: 0,
}

export default function InventoryDashboardPage() {
  const toast = useToast()
  const {
    articles,
    loading,
    pagination,
    alerts,
    valuation,
    movements,
    movementsPagination,
    fetchArticles,
    createArticle,
    updateArticle,
    deleteArticle,
    fetchAlerts,
    fetchValuation,
    fetchMovements,
  } = useInventoryStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Alerts expanded
  const [showAllAlerts, setShowAllAlerts] = useState(false)

  // Initial data load
  useEffect(() => {
    fetchArticles({ active: true })
    fetchAlerts()
    fetchValuation()
    fetchMovements({ limit: 10 })
  }, [])

  // Debounced search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      fetchArticles({ active: true, q: query || undefined, page: 1 })
    }, 300)
    setSearchTimeout(timeout)
  }

  // Pagination
  const handlePageChange = (page: number) => {
    fetchArticles({ active: true, q: searchQuery || undefined, page })
  }

  // Count movements today
  const todayStr = new Date().toISOString().slice(0, 10)
  const movementsToday = movements.filter(
    (m) => m.created_at && m.created_at.slice(0, 10) === todayStr
  ).length

  // CRUD handlers
  const handleAdd = () => {
    setEditingArticle({ ...emptyArticle })
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (article: Article) => {
    setEditingArticle({ ...article })
    setIsEditing(true)
    setShowModal(true)
  }

  const setField = (field: string, value: any) => {
    setEditingArticle((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSave = useCallback(async () => {
    if (!editingArticle) return
    if (!editingArticle.name?.trim()) {
      toast.error('El nombre del articulo es requerido')
      return
    }

    setSaving(true)
    try {
      if (isEditing && editingArticle.id) {
        await updateArticle(editingArticle.id, editingArticle)
        toast.success('Articulo actualizado')
      } else {
        await createArticle(editingArticle)
        toast.success('Articulo creado')
      }
      setShowModal(false)
      setEditingArticle(null)
      fetchArticles({ active: true, q: searchQuery || undefined })
      fetchAlerts()
      fetchValuation()
    } catch {
      toast.error('Error al guardar el articulo')
    } finally {
      setSaving(false)
    }
  }, [editingArticle, isEditing, updateArticle, createArticle, fetchArticles, fetchAlerts, fetchValuation, searchQuery, toast])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true)
      try {
        await deleteArticle(id)
        toast.success('Articulo eliminado')
        setShowDeleteConfirm(null)
        fetchArticles({ active: true, q: searchQuery || undefined })
        fetchAlerts()
        fetchValuation()
      } catch {
        toast.error('Error al eliminar el articulo')
      } finally {
        setDeleting(false)
      }
    },
    [deleteArticle, fetchArticles, fetchAlerts, fetchValuation, searchQuery, toast]
  )

  // Movement type badge
  const movementTypeBadge = (type: string) => {
    switch (type) {
      case 'in':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Entrada
          </span>
        )
      case 'out':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            Salida
          </span>
        )
      case 'adjustment':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Ajuste
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {type}
          </span>
        )
    }
  }

  // Stock badge for alerts
  const stockBadge = (article: Article) => {
    const stock = Number(article.current_stock)
    if (stock === 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          {stock}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
        {stock}
      </span>
    )
  }

  const displayedAlerts = showAllAlerts ? alerts : alerts.slice(0, 5)

  return (
    <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="mt-1 text-sm text-gray-500">
            Panel de control de inventario
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Articulos */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Total Articulos</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{pagination.total}</p>
          </div>

          {/* Valor del Inventario */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Valor del Inventario</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">
              {valuation ? formatCurrency(valuation.total) : '$0.00'}
            </p>
          </div>

          {/* Alertas de Stock Bajo */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Alertas de Stock Bajo</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{alerts.length}</p>
          </div>

          {/* Movimientos Hoy */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Movimientos Hoy</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <ArrowLeftRight className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{movementsToday}</p>
          </div>
        </div>

        {/* Alertas de Stock Bajo */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Alertas de Stock Bajo</h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Stock Actual</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Stock Minimo</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedAlerts.map((alert) => (
                      <tr key={alert.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{alert.name}</td>
                        <td className="px-4 py-3">{stockBadge(alert)}</td>
                        <td className="px-4 py-3 text-gray-600">{Number(alert.min_stock)}</td>
                        <td className="px-4 py-3 text-gray-600">{alert.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {alerts.length > 5 && (
                <div className="border-t border-gray-200 px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    {showAllAlerts ? 'Ver menos' : `Ver todos (${alerts.length})`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Articulos Section */}
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Articulos</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar articulo..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:w-64"
                />
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo Articulo
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Unidad</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Stock Actual</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Stock Minimo</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Costo</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && articles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500">Cargando articulos...</p>
                      </td>
                    </tr>
                  ) : articles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Package className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">No se encontraron articulos</p>
                      </td>
                    </tr>
                  ) : (
                    articles.map((article) => (
                      <tr key={article.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{article.name}</td>
                        <td className="px-4 py-3 text-gray-600">{article.unit}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{Number(article.current_stock)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(article.min_stock)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(article.cost)}</td>
                        <td className="px-4 py-3">
                          {article.active ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(article)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirm(article.id)}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-500">
                  Pagina {pagination.page} de {pagination.pages} ({pagination.total} articulos)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ultimos Movimientos */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Ultimos Movimientos</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Cantidad</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Referencia</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <ArrowLeftRight className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">No hay movimientos registrados</p>
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => (
                      <tr key={movement.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {movement.ingredient_name || '-'}
                        </td>
                        <td className="px-4 py-3">{movementTypeBadge(movement.type)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{Number(movement.quantity)}</td>
                        <td className="px-4 py-3 text-gray-600">{movement.reference || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {movement.created_at
                            ? new Date(movement.created_at).toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && editingArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Editar Articulo' : 'Nuevo Articulo'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="art-name" className={labelClass}>Nombre *</label>
                  <input
                    id="art-name"
                    type="text"
                    value={editingArticle.name || ''}
                    onChange={(e) => setField('name', e.target.value)}
                    className={inputClass}
                    placeholder="Nombre del articulo"
                  />
                </div>

                <div>
                  <label htmlFor="art-unit" className={labelClass}>Unidad</label>
                  <select
                    id="art-unit"
                    value={editingArticle.unit || 'pz'}
                    onChange={(e) => setField('unit', e.target.value)}
                    className={inputClass}
                  >
                    <option value="kg">kg</option>
                    <option value="lt">lt</option>
                    <option value="pz">pz</option>
                    <option value="caja">caja</option>
                    <option value="bolsa">bolsa</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="art-stock" className={labelClass}>Stock Actual</label>
                    <input
                      id="art-stock"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingArticle.current_stock ?? ''}
                      onChange={(e) => setField('current_stock', e.target.value)}
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="art-min-stock" className={labelClass}>Stock Minimo</label>
                    <input
                      id="art-min-stock"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingArticle.min_stock ?? ''}
                      onChange={(e) => setField('min_stock', e.target.value)}
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="art-cost" className={labelClass}>Costo</label>
                  <input
                    id="art-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingArticle.cost ?? ''}
                    onChange={(e) => setField('cost', e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditing ? 'Guardar cambios' : 'Crear articulo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                Eliminar articulo
              </h3>
              <p className="mb-6 text-sm text-gray-500">
                Esta accion no se puede deshacer. El articulo sera eliminado permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deleting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
