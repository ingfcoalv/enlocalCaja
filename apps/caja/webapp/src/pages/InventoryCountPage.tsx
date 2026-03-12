import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardList,
  Search,
  Save,
  Loader2,
  Trash2,
  PlayCircle,
} from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useInventoryStore } from '../stores/useInventoryStore'


interface CountItem {
  ingredient_id: string
  name: string
  unit: string
  expected_qty: number
  counted_qty: number
  difference: number
  notes: string
}

const DRAFT_KEY = 'inventory-count-draft'

export default function InventoryCountPage() {
  const toast = useToast()
  const { articles, fetchArticles, saveCount } = useInventoryStore()

  const [counting, setCounting] = useState(false)
  const [countItems, setCountItems] = useState<CountItem[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [countNotes, setCountNotes] = useState('')

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!counting || countItems.length === 0) return

    const interval = setInterval(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(countItems))
    }, 30000)

    return () => clearInterval(interval)
  }, [counting, countItems])

  const handleStartCount = useCallback(async () => {
    try {
      await fetchArticles({ active: true, limit: 1000 })
    } catch {
      toast.error('Error al cargar los articulos')
      return
    }

    // Use the store's articles after fetch
    const { articles: freshArticles } = useInventoryStore.getState()

    const items: CountItem[] = freshArticles.map((a) => ({
      ingredient_id: a.id,
      name: a.name,
      unit: a.unit,
      expected_qty: Number(a.current_stock),
      counted_qty: 0,
      difference: -Number(a.current_stock),
      notes: '',
    }))

    // Check for saved draft
    const draft = localStorage.getItem(DRAFT_KEY)
    if (draft) {
      try {
        const parsed: CountItem[] = JSON.parse(draft)
        if (parsed.length > 0 && window.confirm('Se encontro un borrador guardado. ¿Desea restaurarlo?')) {
          setCountItems(parsed)
          setCounting(true)
          return
        }
      } catch {
        // Invalid draft, ignore
      }
    }

    setCountItems(items)
    setCounting(true)
  }, [fetchArticles, toast])

  const handleCountedQtyChange = useCallback((index: number, value: number) => {
    setCountItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, counted_qty: value, difference: value - item.expected_qty }
          : item
      )
    )
  }, [])

  const handleNotesChange = useCallback((index: number, value: string) => {
    setCountItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, notes: value } : item))
    )
  }, [])

  const handleClear = useCallback(() => {
    if (!window.confirm('¿Esta seguro de limpiar todos los conteos? Esta accion no se puede deshacer.')) return
    setCountItems((prev) =>
      prev.map((item) => ({
        ...item,
        counted_qty: 0,
        difference: -item.expected_qty,
      }))
    )
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await saveCount({
        notes: countNotes || undefined,
        items: countItems.map((i) => ({
          ingredient_id: i.ingredient_id,
          expected_qty: i.expected_qty,
          counted_qty: i.counted_qty,
          difference: i.difference,
          notes: i.notes || undefined,
        })),
      })
      toast.success('Conteo guardado exitosamente')
      localStorage.removeItem(DRAFT_KEY)
      setCounting(false)
      setCountItems([])
      setCountNotes('')
    } catch {
      toast.error('Error al guardar el conteo')
    } finally {
      setSaving(false)
    }
  }, [countItems, countNotes, saveCount, toast])

  const filteredItems = countItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Conteo de Inventario</h1>
          <p className="mt-1 text-sm text-gray-500">
            Realiza un conteo fisico del inventario y compara con el stock del sistema.
          </p>
        </div>

        {!counting ? (
          /* Phase 1: Not counting */
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <ClipboardList className="h-5 w-5 text-primary-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Nuevo Conteo Fisico</h2>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                El conteo de inventario permite comparar las existencias fisicas con las registradas en el sistema.
                Al iniciar, se cargaran todos los articulos activos con su stock actual como referencia.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Ingresa la cantidad contada para cada articulo. Las diferencias se calcularan automaticamente.
                El borrador se guarda cada 30 segundos para evitar perdida de datos.
              </p>
              <button
                onClick={handleStartCount}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <PlayCircle className="h-4 w-4" />
                Iniciar Conteo
              </button>
            </div>
          </div>
        ) : (
          /* Phase 2: Counting */
          <div className="space-y-4">
            {/* Header bar */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Search */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar articulo..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpiar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Guardar Conteo
                    </button>
                  </div>
                </div>

                {/* General notes */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Notas generales del conteo
                  </label>
                  <textarea
                    value={countNotes}
                    onChange={(e) => setCountNotes(e.target.value)}
                    rows={2}
                    placeholder="Observaciones generales sobre este conteo..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Count table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Unidad</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Stock Sistema</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Conteo Fisico</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Diferencia</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => {
                      // Find the real index in countItems for correct state updates
                      const realIndex = countItems.findIndex(
                        (ci) => ci.ingredient_id === item.ingredient_id
                      )
                      const rowBg =
                        item.difference < 0
                          ? 'bg-red-50'
                          : item.difference > 0
                            ? 'bg-green-50'
                            : ''

                      return (
                        <tr
                          key={item.ingredient_id}
                          className={`border-b border-gray-100 ${rowBg}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {item.expected_qty}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.counted_qty}
                              onChange={(e) =>
                                handleCountedQtyChange(
                                  realIndex,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-medium ${
                                item.difference < 0
                                  ? 'text-red-600'
                                  : item.difference > 0
                                    ? 'text-green-600'
                                    : 'text-gray-700'
                              }`}
                            >
                              {item.difference > 0 ? '+' : ''}
                              {item.difference}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) =>
                                handleNotesChange(realIndex, e.target.value)
                              }
                              placeholder="..."
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-sm text-gray-500"
                        >
                          No se encontraron articulos
                          {search ? ` que coincidan con "${search}"` : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Summary footer */}
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm text-gray-600">
                  {filteredItems.length} de {countItems.length} articulos
                  {' — '}
                  <span className="text-red-600 font-medium">
                    {countItems.filter((i) => i.difference < 0).length} con faltante
                  </span>
                  {', '}
                  <span className="text-green-600 font-medium">
                    {countItems.filter((i) => i.difference > 0).length} con sobrante
                  </span>
                  {', '}
                  <span className="text-gray-700 font-medium">
                    {countItems.filter((i) => i.difference === 0).length} sin diferencia
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
