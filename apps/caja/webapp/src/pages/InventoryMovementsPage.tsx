import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Plus,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useInventoryStore } from '../stores/useInventoryStore'

export default function InventoryMovementsPage() {
  const toast = useToast()
  const {
    articles,
    movements,
    movementsPagination,
    fetchArticles,
    fetchMovements,
    createMovement,
  } = useInventoryStore()

  // Filters
  const [filterArticle, setFilterArticle] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [page, setPage] = useState(1)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [formArticle, setFormArticle] = useState('')
  const [formType, setFormType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [formQuantity, setFormQuantity] = useState('')
  const [formReference, setFormReference] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Article search in modal
  const [articleSearch, setArticleSearch] = useState('')
  const [articleDropdownOpen, setArticleDropdownOpen] = useState(false)
  const articleSearchRef = useRef<HTMLInputElement>(null)
  const articleDropdownRef = useRef<HTMLDivElement>(null)

  const filteredArticles = useMemo(() => {
    if (!articleSearch.trim()) return articles
    const q = articleSearch.toLowerCase()
    return articles.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.sku && a.sku.toLowerCase().includes(q))
    )
  }, [articles, articleSearch])

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === formArticle),
    [articles, formArticle]
  )

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        articleDropdownRef.current &&
        !articleDropdownRef.current.contains(e.target as Node) &&
        articleSearchRef.current &&
        !articleSearchRef.current.contains(e.target as Node)
      ) {
        setArticleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Loading
  const [loading, setLoading] = useState(true)

  // Fetch articles on mount
  useEffect(() => {
    fetchArticles({ active: true, limit: 500 })
  }, [])

  // Fetch movements when filters or page change
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchMovements({
        ingredient_id: filterArticle || undefined,
        type: filterType || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        page,
      })
      setLoading(false)
    }
    load()
  }, [filterArticle, filterType, filterFrom, filterTo, page])

  const handleOpenModal = () => {
    setFormArticle('')
    setArticleSearch('')
    setArticleDropdownOpen(false)
    setFormType('in')
    setFormQuantity('')
    setFormReference('')
    setFormNotes('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formArticle) {
      toast.error('Selecciona un articulo')
      return
    }
    const qty = parseFloat(formQuantity)
    if (!formQuantity || isNaN(qty) || qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      await createMovement({
        ingredient_id: formArticle,
        type: formType,
        quantity: qty,
        reference: formReference || undefined,
        notes: formNotes || undefined,
      })
      toast.success('Movimiento creado exitosamente')
      setShowModal(false)
      // Refetch movements with current filters
      await fetchMovements({
        ingredient_id: filterArticle || undefined,
        type: filterType || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        page,
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear movimiento')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatQuantity = (type: string, quantity: number | string) => {
    const q = typeof quantity === 'string' ? parseFloat(quantity) : quantity
    if (type === 'in') return `+${q}`
    if (type === 'out') return `-${q}`
    return `${q}`
  }

  const typeBadge = (type: string) => {
    if (type === 'in') {
      return (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          Entrada
        </span>
      )
    }
    if (type === 'out') {
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          Salida
        </span>
      )
    }
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Ajuste
      </span>
    )
  }

  return (
    <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Movimientos de Inventario</h1>
          <p className="mt-1 text-sm text-gray-500">
            {movementsPagination.total} movimientos registrados
          </p>
        </div>

        {/* Filters Bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Article filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Articulo</label>
              <select
                value={filterArticle}
                onChange={(e) => { setFilterArticle(e.target.value); setPage(1) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Todos los articulos</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Todos</option>
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => { setFilterFrom(e.target.value); setPage(1) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => { setFilterTo(e.target.value); setPage(1) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {/* New Movement button */}
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Nuevo Movimiento
          </button>
        </div>

        {/* Movements Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No se encontraron movimientos
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Cantidad</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Referencia</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {m.ingredient_name || '—'}
                      </td>
                      <td className="px-4 py-3">{typeBadge(m.type)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatQuantity(m.type, m.quantity)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{m.reference || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.notes || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && movements.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-600">
                Mostrando {movements.length} de {movementsPagination.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={movementsPagination.page <= 1}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Pagina {movementsPagination.page} de {movementsPagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(movementsPagination.pages, p + 1))}
                  disabled={movementsPagination.page >= movementsPagination.pages}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Movement Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Nuevo Movimiento</h2>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Articulo — buscador */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Articulo *
                  </label>

                  {formArticle && selectedArticle ? (
                    <div className="flex items-center justify-between rounded-lg border border-primary-300 bg-primary-50 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedArticle.name}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({selectedArticle.unit})
                          {selectedArticle.sku && ` — ${selectedArticle.sku}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormArticle('')
                          setArticleSearch('')
                          setTimeout(() => articleSearchRef.current?.focus(), 50)
                        }}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          ref={articleSearchRef}
                          type="text"
                          value={articleSearch}
                          onChange={(e) => {
                            setArticleSearch(e.target.value)
                            setArticleDropdownOpen(true)
                          }}
                          onFocus={() => setArticleDropdownOpen(true)}
                          placeholder="Buscar por nombre o SKU..."
                          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="off"
                        />
                      </div>
                      {articleDropdownOpen && (
                        <div
                          ref={articleDropdownRef}
                          className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                        >
                          {filteredArticles.length === 0 ? (
                            <div className="px-3 py-3 text-center text-sm text-gray-400">
                              Sin resultados
                            </div>
                          ) : (
                            filteredArticles.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  setFormArticle(a.id)
                                  setArticleSearch('')
                                  setArticleDropdownOpen(false)
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50"
                              >
                                <span className="font-medium text-gray-900">{a.name}</span>
                                <span className="ml-2 flex-shrink-0 text-xs text-gray-500">
                                  {a.sku && `${a.sku} · `}{a.unit}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tipo */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Tipo *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="movement-type"
                        value="in"
                        checked={formType === 'in'}
                        onChange={() => setFormType('in')}
                        className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Entrada</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="movement-type"
                        value="out"
                        checked={formType === 'out'}
                        onChange={() => setFormType('out')}
                        className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Salida</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="movement-type"
                        value="adjustment"
                        checked={formType === 'adjustment'}
                        onChange={() => setFormType('adjustment')}
                        className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Ajuste</span>
                    </label>
                  </div>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                {/* Referencia */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Referencia
                  </label>
                  <input
                    type="text"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    placeholder="Factura, orden de compra, etc."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Notas
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    placeholder="Notas adicionales..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  type="button"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
