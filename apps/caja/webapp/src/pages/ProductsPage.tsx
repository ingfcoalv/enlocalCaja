import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Package,
  Filter,
  Tag,
  Weight,
  Upload,
} from 'lucide-react'
import { useCRUD, useToast, useAuth } from '@enlocal/react-hooks'
import ImportProductsModal from '../components/ImportProductsModal'

interface PriceEntry {
  priceListId: string
  priceListName?: string
  price: string
}

interface PriceListOption {
  id: string
  name: string
  isDefault: boolean
}

interface Product {
  id: string
  name: string
  sku?: string
  barcode?: string
  price: number | string
  cost?: number
  category?: string
  categoryId?: string
  taxRate?: number | string
  objetoImpuesto?: string
  iepsRate?: number | string
  satCode?: string
  satUnit?: string
  minStock?: number
  description?: string
  active?: boolean
  prices?: PriceEntry[]
  sellByWeight?: boolean
  saleUnit?: string
}

const emptyProduct: Partial<Product> & { prices: PriceEntry[] } = {
  name: '',
  sku: '',
  barcode: '',
  price: 0,
  cost: 0,
  category: '',
  taxRate: 0.16,
  objetoImpuesto: '02',
  iepsRate: 0,
  satCode: '01010101',
  satUnit: 'E48',
  minStock: 0,
  description: '',
  active: true,
  prices: [],
  sellByWeight: false,
  saleUnit: 'kg',
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

export default function ProductsPage() {
  const toast = useToast()
  const { token } = useAuth()
  const { items, loading, error, pagination, fetchAll, create, update, remove } =
    useCRUD<Product>('/api/products')

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [priceLists, setPriceLists] = useState<PriceListOption[]>([])

  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<(Partial<Product> & { prices: PriceEntry[] }) | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    fetchAll()
    const h = { Authorization: `Bearer ${token}` }
    // Fetch price lists
    fetch('/api/price-lists?active=true', { headers: h })
      .then((r) => r.json())
      .then((json) => setPriceLists(json.data || []))
      .catch(() => {})
    // Fetch categories
    fetch('/api/categories?active=true', { headers: h })
      .then((r) => r.json())
      .then((json) => setCategories(json.data || []))
      .catch(() => {})
  }, [fetchAll, token])

  const filteredProducts = items.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      !categoryFilter || p.categoryId === categoryFilter
    return matchesSearch && matchesCategory
  })

  const getCategoryName = (categoryId?: string | null) => {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId)?.name || null
  }

  const handleAdd = () => {
    // Pre-fill prices array with one entry per active price list (all at 0)
    const pricesInit = priceLists.map((pl) => ({
      priceListId: pl.id,
      priceListName: pl.name,
      price: '',
    }))
    setEditingProduct({ ...emptyProduct, prices: pricesInit })
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (product: Product) => {
    // Merge existing prices with all available price lists
    const existingPrices = product.prices || []
    const pricesMap: Record<string, string> = {}
    for (const p of existingPrices) {
      pricesMap[p.priceListId] = p.price
    }
    const mergedPrices = priceLists.map((pl) => ({
      priceListId: pl.id,
      priceListName: pl.name,
      price: pricesMap[pl.id] || '',
    }))
    setEditingProduct({ ...product, prices: mergedPrices })
    setIsEditing(true)
    setShowModal(true)
  }

  const setField = (field: string, value: any) => {
    setEditingProduct((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const setPriceForList = (priceListId: string, price: string) => {
    setEditingProduct((prev) => {
      if (!prev) return prev
      const prices = prev.prices.map((p) =>
        p.priceListId === priceListId ? { ...p, price } : p
      )
      return { ...prev, prices }
    })
  }

  const handleSave = useCallback(async () => {
    if (!editingProduct) return
    if (!editingProduct.name?.trim()) {
      toast.error('El nombre del producto es requerido')
      return
    }
    if (!editingProduct.price || Number(editingProduct.price) <= 0) {
      toast.error('El precio base debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...editingProduct,
        prices: editingProduct.prices
          .filter((p) => p.price && parseFloat(p.price) > 0)
          .map((p) => ({ priceListId: p.priceListId, price: p.price })),
      }

      if (isEditing && editingProduct.id) {
        await update(editingProduct.id, payload)
        toast.success('Producto actualizado')
      } else {
        await create(payload)
        toast.success('Producto creado')
      }
      setShowModal(false)
      setEditingProduct(null)
      fetchAll()
    } catch {
      toast.error('Error al guardar el producto')
    } finally {
      setSaving(false)
    }
  }, [editingProduct, isEditing, update, create, fetchAll, toast])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true)
      try {
        await remove(id)
        toast.success('Producto eliminado')
        setShowDeleteConfirm(null)
      } catch {
        toast.error('Error al eliminar el producto')
      } finally {
        setDeleting(false)
      }
    },
    [remove, toast]
  )

  const formatCurrency = (amount: number | string): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(amount))
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} productos en catalogo
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            type="button"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 py-2.5 pl-10 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Todas las categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Producto</th>
                <th className="px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Precio Base</th>
                {priceLists.map((pl) => (
                  <th key={pl.id} className="px-4 py-3 text-right font-medium text-gray-600">
                    <div className="flex items-center justify-end gap-1">
                      <Tag className="h-3 w-3" />
                      {pl.name}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4 + priceLists.length} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando productos...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4 + priceLists.length} className="px-4 py-12 text-center">
                    <Package className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No se encontraron productos</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const pricesMap: Record<string, string> = {}
                  for (const p of product.prices || []) {
                    pricesMap[p.priceListId] = p.price
                  }
                  return (
                    <tr
                      key={product.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        {product.description && (
                          <p className="mt-0.5 text-xs text-gray-400 truncate max-w-xs">
                            {product.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {product.sku || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(product.price)}
                      </td>
                      {priceLists.map((pl) => (
                        <td key={pl.id} className="px-4 py-3 text-right text-gray-600">
                          {pricesMap[pl.id] ? formatCurrency(pricesMap[pl.id]) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(product)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                            title="Editar"
                            type="button"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(product.id)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Editar producto' : 'Nuevo producto'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="prod-name" className={labelClass}>Nombre *</label>
                  <input
                    id="prod-name"
                    type="text"
                    value={editingProduct.name || ''}
                    onChange={(e) => setField('name', e.target.value)}
                    className={inputClass}
                    placeholder="Nombre del producto"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="prod-sku" className={labelClass}>SKU</label>
                    <input
                      id="prod-sku"
                      type="text"
                      value={editingProduct.sku || ''}
                      onChange={(e) => setField('sku', e.target.value)}
                      className={inputClass}
                      placeholder="SKU-001"
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-barcode" className={labelClass}>Codigo de Barras</label>
                    <input
                      id="prod-barcode"
                      type="text"
                      value={editingProduct.barcode || ''}
                      onChange={(e) => setField('barcode', e.target.value)}
                      className={inputClass}
                      placeholder="7501234567890"
                    />
                  </div>
                  <div>
                    <label htmlFor="prod-category" className={labelClass}>Categoria</label>
                    <select
                      id="prod-category"
                      value={editingProduct.categoryId || ''}
                      onChange={(e) => setField('categoryId', e.target.value || null)}
                      className={inputClass}
                    >
                      <option value="">Sin categoria</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prices section */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <Tag className="h-4 w-4" />
                    Precios
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="prod-price" className={labelClass}>Precio Base *</label>
                      <input
                        id="prod-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingProduct.price || ''}
                        onChange={(e) => setField('price', e.target.value)}
                        className={inputClass}
                        placeholder="0.00"
                      />
                      <p className="mt-1 text-xs text-primary-600 font-medium">El precio es Neto (incluye IVA)</p>
                    </div>
                    <div>
                      <label htmlFor="prod-cost" className={labelClass}>Costo</label>
                      <input
                        id="prod-cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingProduct.cost || ''}
                        onChange={(e) => setField('cost', parseFloat(e.target.value) || 0)}
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {editingProduct.prices.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-500">Precios por lista (dejar vacio para usar precio base):</p>
                      <div className="grid grid-cols-2 gap-3">
                        {editingProduct.prices.map((pe) => (
                          <div key={pe.priceListId} className="flex items-center gap-2">
                            <label className="min-w-[100px] text-sm text-gray-600 truncate" title={pe.priceListName}>
                              {pe.priceListName}:
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pe.price}
                              onChange={(e) => setPriceForList(pe.priceListId, e.target.value)}
                              className={inputClass}
                              placeholder="Precio base"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="prod-min-stock" className={labelClass}>Stock minimo</label>
                  <input
                    id="prod-min-stock"
                    type="number"
                    min="0"
                    value={editingProduct.minStock ?? ''}
                    onChange={(e) => setField('minStock', parseInt(e.target.value) || 0)}
                    className={inputClass}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-gray-400">Alerta cuando baje de este nivel. El stock se gestiona desde Inventario.</p>
                </div>

                {/* Venta a granel */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <Weight className="h-4 w-4" />
                    Venta a granel
                  </h4>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={editingProduct.sellByWeight || false}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setField('sellByWeight', checked)
                          if (checked) {
                            // Auto-set SAT unit based on sale unit
                            const unit = editingProduct.saleUnit || 'kg'
                            if (unit === 'kg' || unit === 'g') {
                              setField('satUnit', 'KGM')
                            } else if (unit === 'L' || unit === 'mL') {
                              setField('satUnit', 'LTR')
                            }
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-primary-600 transition-colors" />
                      <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Vender por peso/volumen</span>
                  </label>

                  {editingProduct.sellByWeight && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label htmlFor="prod-sale-unit" className={labelClass}>Unidad de venta</label>
                        <select
                          id="prod-sale-unit"
                          value={editingProduct.saleUnit || 'kg'}
                          onChange={(e) => {
                            const unit = e.target.value
                            setField('saleUnit', unit)
                            // Auto-set SAT unit
                            if (unit === 'kg' || unit === 'g') {
                              setField('satUnit', 'KGM')
                            } else if (unit === 'L' || unit === 'mL') {
                              setField('satUnit', 'LTR')
                            }
                          }}
                          className={inputClass}
                        >
                          <option value="kg">Kilogramo (kg)</option>
                          <option value="g">Gramo (g)</option>
                          <option value="L">Litro (L)</option>
                          <option value="mL">Mililitro (mL)</option>
                        </select>
                      </div>
                      <p className="text-xs text-primary-600 font-medium">
                        El precio base se interpreta como "por {editingProduct.saleUnit || 'kg'}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Configuracion Fiscal */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Configuracion Fiscal
                  </h4>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="prod-tax" className={labelClass}>Tasa de IVA</label>
                        <select
                          id="prod-tax"
                          value={editingProduct.taxRate ?? 0.16}
                          onChange={(e) => setField('taxRate', parseFloat(e.target.value))}
                          className={inputClass}
                        >
                          <option value={0.16}>16% (General)</option>
                          <option value={0.08}>8% (Frontera)</option>
                          <option value={0}>0% (Exento)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-400">Tasa general Mexico</p>
                      </div>
                      <div>
                        <label htmlFor="prod-objeto" className={labelClass}>Objeto de Impuesto</label>
                        <select
                          id="prod-objeto"
                          value={editingProduct.objetoImpuesto ?? '02'}
                          onChange={(e) => setField('objetoImpuesto', e.target.value)}
                          className={inputClass}
                        >
                          <option value="01">01 - No objeto de impuesto</option>
                          <option value="02">02 - Si objeto de impuesto</option>
                          <option value="03">03 - Si objeto de impuesto y no obligado al desglose</option>
                          <option value="04">04 - Si objeto de impuesto y no causa impuesto</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-400">Catalogo de objetos de impuesto</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="prod-ieps" className={labelClass}>Tasa IEPS</label>
                        <select
                          id="prod-ieps"
                          value={editingProduct.iepsRate ?? 0}
                          onChange={(e) => setField('iepsRate', parseFloat(e.target.value))}
                          className={inputClass}
                        >
                          <option value={0}>No aplica IEPS</option>
                          <option value={0.08}>8%</option>
                          <option value={0.25}>25%</option>
                          <option value={0.265}>26.5%</option>
                          <option value={0.30}>30%</option>
                          <option value={0.53}>53%</option>
                          <option value={1.60}>160%</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-400">Impuesto especial a ciertos productos</p>
                      </div>
                      <div>
                        <label htmlFor="prod-satcode" className={labelClass}>Clave SAT</label>
                        <input
                          id="prod-satcode"
                          type="text"
                          value={editingProduct.satCode ?? '01010101'}
                          onChange={(e) => setField('satCode', e.target.value)}
                          className={inputClass}
                          placeholder="01010101"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          <a
                            href="http://pys.sat.gob.mx/PyS/catPyS.aspx"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            Buscar clave
                          </a>
                          {' '}en el catalogo SAT
                        </p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="prod-satunit" className={labelClass}>Clave Unidad SAT</label>
                      <select
                        id="prod-satunit"
                        value={editingProduct.satUnit ?? 'E48'}
                        onChange={(e) => setField('satUnit', e.target.value)}
                        className={inputClass}
                      >
                        <option value="H87">H87 - Pieza</option>
                        <option value="E48">E48 - Unidad de servicio</option>
                        <option value="KGM">KGM - Kilogramo</option>
                        <option value="LTR">LTR - Litro</option>
                        <option value="XBX">XBX - Caja</option>
                        <option value="ACT">ACT - Actividad</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-400">Catalogo claves SAT</p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-400 italic">
                    La configuracion fiscal se usara automaticamente al facturar ventas de este producto.
                  </p>
                </div>

                <div>
                  <label htmlFor="prod-desc" className={labelClass}>Descripcion</label>
                  <textarea
                    id="prod-desc"
                    value={editingProduct.description || ''}
                    onChange={(e) => setField('description', e.target.value)}
                    rows={3}
                    className={inputClass}
                    placeholder="Descripcion del producto"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
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
                {isEditing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportProductsModal
          onClose={() => setShowImport(false)}
          onImported={() => fetchAll()}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Eliminar producto
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              Esta accion no se puede deshacer. El producto sera eliminado
              permanentemente del catalogo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                type="button"
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
