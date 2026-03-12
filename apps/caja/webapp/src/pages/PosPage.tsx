import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Search,
  Minus,
  Plus,
  Trash2,
  X,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  ShoppingCart,
  DoorOpen,
  DoorClosed,
  User,
  Loader2,
  StickyNote,
  Weight,
  ClipboardList,
  AlertTriangle,
  Percent,
} from 'lucide-react'
import { api, useToast, useModuleAccess, useAuth } from '@enlocal/react-hooks'
import { useCartStore } from '../stores/useCartStore'
import { usePosStore } from '../stores/usePosStore'
import { useCashMovementsStore } from '../stores/useCashMovementsStore'
import MixedPaymentModal from '../components/MixedPaymentModal'
import WeightInputModal from '../components/WeightInputModal'

interface RegisterOption {
  id: string
  name: string
  isActive: boolean
  currentShift?: { id: string; userName: string } | null
}

interface Product {
  id: string
  name: string
  price: number
  category?: string
  sku?: string
  barcode?: string
  taxRate?: number
  image?: string
  sellByWeight?: boolean
  saleUnit?: string | null
  currentStock?: number
  minStock?: number
  prices?: { priceListId: string; priceListName: string; price: number | string }[]
}

interface Category {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  creditLimit?: number
  priceListId?: string | null
  defaultDiscount?: number | string
}

export default function PosPage() {
  const toast = useToast()
  const { user } = useAuth()
  const maxDiscountPct = user?.maxDiscountPercent ?? 100
  const {
    items,
    addItem,
    addWeightItem,
    removeItem,
    updateQuantity,
    updateItemPrice,
    updateItemDiscount,
    customerId,
    setCustomer,
    observations,
    setObservations,
    clear,
    subtotal,
    tax,
    total,
    totalDiscount,
  } = useCartStore()

  const { currentShift, currentRegister, shiftLoading, openShift, closeShift, fetchCurrentShift, shiftPreview, previewLoading, fetchShiftPreview } =
    usePosStore()
  const { hasAccess: hasMulticaja } = useModuleAccess('multicaja')
  const [showCorteX, setShowCorteX] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(true)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showObservations, setShowObservations] = useState(false)
  const [weightProduct, setWeightProduct] = useState<Product | null>(null)

  const [showShiftModal, setShowShiftModal] = useState(false)
  const [shiftAction, setShiftAction] = useState<'open' | 'close'>('open')
  const [shiftAmount, setShiftAmount] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [myRegisters, setMyRegisters] = useState<RegisterOption[]>([])
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('')
  const [loadingRegisters, setLoadingRegisters] = useState(false)

  // Partial withdrawal state
  const [showPartialWithdrawal, setShowPartialWithdrawal] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalLeave, setWithdrawalLeave] = useState('500')
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false)
  const { createMovement } = useCashMovementsStore()

  // Barcode scanner state
  const barcodeBuffer = useRef('')
  const lastKeyTime = useRef(0)

  // Payment processing state (prevent double-clicks)
  const [processing, setProcessing] = useState(false)

  // Editing discount state
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)
  const [discountInput, setDiscountInput] = useState('')

  // Fetch products and categories on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingProducts(true)
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/categories').catch(() => ({ data: [] })),
        ])
        const productData = productsRes.data?.data || productsRes.data?.items || productsRes.data || []
        setProducts(Array.isArray(productData) ? productData : [])
        const categoryData = categoriesRes.data?.data || categoriesRes.data || []
        setCategories(Array.isArray(categoryData) ? categoryData : [])
      } catch {
        toast.error('Error al cargar productos')
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchData()
    fetchCurrentShift()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch customers for selector
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/api/customers', {
          params: { limit: 100 },
        })
        const data = res.data?.data || res.data?.items || res.data || []
        setCustomers(Array.isArray(data) ? data : [])
      } catch {
        // Customers are optional
      }
    }
    fetchCustomers()
  }, [])

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })

  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch) ||
      c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const selectedCustomer = customers.find((c) => c.id === customerId)

  const getEffectivePrice = useCallback(
    (product: Product): number => {
      if (selectedCustomer?.priceListId && product.prices) {
        const pl = product.prices.find((p) => p.priceListId === selectedCustomer.priceListId)
        if (pl) return typeof pl.price === 'string' ? parseFloat(pl.price) : pl.price
      }
      return product.price
    },
    [selectedCustomer]
  )

  const getCustomerDiscount = useCallback((): number => {
    const d = parseFloat(String(selectedCustomer?.defaultDiscount ?? 0))
    return d > 0 ? Math.min(d, maxDiscountPct) : 0
  }, [selectedCustomer, maxDiscountPct])

  const handleAddToCart = useCallback(
    (product: Product) => {
      // Stock warning (don't block)
      if (product.currentStock != null && product.currentStock <= 0) {
        toast.warning(`"${product.name}" sin stock disponible`)
      }

      if (product.sellByWeight) {
        setWeightProduct(product)
        return
      }

      const effectivePrice = getEffectivePrice(product)
      const discount = getCustomerDiscount()

      addItem(
        { id: product.id, name: product.name, price: product.price, taxRate: product.taxRate },
        effectivePrice,
        discount,
      )
    },
    [addItem, toast, getEffectivePrice, getCustomerDiscount]
  )

  const handleWeightConfirm = useCallback(
    (quantity: number) => {
      if (!weightProduct) return

      // Stock warning
      if (weightProduct.currentStock != null && weightProduct.currentStock <= 0) {
        toast.warning(`"${weightProduct.name}" sin stock disponible`)
      }

      const effectivePrice = getEffectivePrice(weightProduct)
      const discount = getCustomerDiscount()

      addWeightItem(
        {
          id: weightProduct.id,
          name: weightProduct.name,
          price: weightProduct.price,
          taxRate: weightProduct.taxRate,
          saleUnit: weightProduct.saleUnit,
        },
        quantity,
        effectivePrice,
        discount,
      )
      setWeightProduct(null)
    },
    [weightProduct, addWeightItem, toast, getEffectivePrice, getCustomerDiscount]
  )

  const shiftOpen = currentShift && currentShift.status === 'open'

  const handleOpenPayment = () => {
    if (!shiftOpen) {
      toast.warning('Debes abrir un turno de caja para poder vender')
      return
    }
    if (items.length === 0) {
      toast.warning('Agrega productos al carrito')
      return
    }
    setShowPaymentModal(true)
  }

  const handleConfirmPayment = async (
    payments: { method: string; amount: number; reference?: string }[],
    cashTendered?: number
  ) => {
    if (processing) return
    setProcessing(true)
    try {
      await api.post('/api/sales', {
        items: items.map((item) => {
          const lineGross = item.price * item.quantity
          const discountAmt = item.discount > 0 ? Math.round(lineGross * (item.discount / 100) * 100) / 100 : 0
          return {
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            discount: discountAmt > 0 ? discountAmt : undefined,
            taxRate: item.taxRate,
            sellByWeight: item.sellByWeight || undefined,
            saleUnit: item.saleUnit || undefined,
          }
        }),
        customerId: customerId,
        payments,
        subtotal: subtotal(),
        tax: tax(),
        total: total(),
        cashTendered,
        observations: observations || undefined,
        shiftId: currentShift?.id,
      })

      toast.success('Venta registrada exitosamente')
      clear()
      setShowPaymentModal(false)

      // Trigger cloud sync after sale
      try {
        await api.post('/api/sync/trigger', { trigger: 'sale_close' })
      } catch {
        // Non-critical: sync will happen on next interval
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Error al procesar la venta'
      toast.error(message)
      throw err
    } finally {
      setProcessing(false)
    }
  }

  // Apply/reset customer pricing when customer changes
  useEffect(() => {
    const { items: currentItems, updateItemPrice: storeUpdatePrice, updateItemDiscount: storeUpdateDiscount } = useCartStore.getState()
    if (!customerId) {
      // Reset prices and discounts
      currentItems.forEach((item) => {
        if (item.price !== item.originalPrice) storeUpdatePrice(item.id, item.originalPrice)
        if (item.discount !== 0) storeUpdateDiscount(item.id, 0)
      })
      return
    }
    const customer = customers.find((c) => c.id === customerId)
    if (!customer) return

    const safeMaxDiscount = Number.isFinite(maxDiscountPct) ? maxDiscountPct : 0
    const defaultDiscount = Math.min(parseFloat(String(customer.defaultDiscount ?? 0)), safeMaxDiscount)

    currentItems.forEach((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) return

      // Apply price list
      let newPrice = item.originalPrice
      if (customer.priceListId && product.prices) {
        const pl = product.prices.find((p) => p.priceListId === customer.priceListId)
        if (pl) newPrice = typeof pl.price === 'string' ? parseFloat(pl.price as string) : pl.price
      }
      if (item.price !== newPrice) storeUpdatePrice(item.id, newPrice)

      // Apply default discount
      if (defaultDiscount > 0 && item.discount !== defaultDiscount) {
        storeUpdateDiscount(item.id, defaultDiscount)
      }
    })
  }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      const now = Date.now()
      if (now - lastKeyTime.current > 500) barcodeBuffer.current = ''

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3) {
        const code = barcodeBuffer.current
        const found = products.find((p) => p.barcode === code)
        if (found) {
          handleAddToCart(found)
        } else {
          toast.warning(`Producto no encontrado: ${code}`)
        }
        barcodeBuffer.current = ''
        return
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key
        lastKeyTime.current = now
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [products, handleAddToCart, toast])

  const handleShiftAction = async () => {
    const amount = parseFloat(shiftAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingresa un monto valido')
      return
    }

    if (shiftAction === 'open' && hasMulticaja && !selectedRegisterId) {
      toast.error('Debes seleccionar una caja')
      return
    }

    try {
      if (shiftAction === 'open') {
        await openShift(amount, selectedRegisterId || undefined)
        toast.success('Turno abierto exitosamente')
      } else {
        await closeShift(amount, shiftNotes || undefined)
        toast.success('Turno cerrado exitosamente')
      }
      setShowShiftModal(false)
      setShiftAmount('')
      setShiftNotes('')
    } catch (err: any) {
      toast.error(err?.message || (
        shiftAction === 'open'
          ? 'Error al abrir turno'
          : 'Error al cerrar turno'
      ))
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left side: Products */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Shift controls */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentShift && currentShift.status === 'open' ? (
              <span className="flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                <div className="h-2 w-2 rounded-full bg-primary-500" />
                {currentRegister ? `${currentRegister.name} — Turno abierto` : 'Turno abierto'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                Sin turno
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {!currentShift || currentShift.status !== 'open' ? (
              <button
                onClick={async () => {
                  setShiftAction('open')
                  setShiftAmount('')
                  setShiftNotes('')
                  setSelectedRegisterId('')
                  setShowShiftModal(true)
                  // Fetch available registers
                  setLoadingRegisters(true)
                  try {
                    const res = await api.get('/api/pos/registers/my')
                    const regs = res.data?.data || []
                    setMyRegisters(regs)
                    if (regs.length === 1) setSelectedRegisterId(regs[0].id)
                  } catch {
                    setMyRegisters([])
                  } finally {
                    setLoadingRegisters(false)
                  }
                }}
                disabled={shiftLoading}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="button"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Abrir turno
              </button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    await fetchShiftPreview()
                    setShowCorteX(true)
                  }}
                  disabled={shiftLoading || previewLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                  type="button"
                  title="Corte X - Vista previa sin cerrar"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Corte X
                </button>
                <button
                  onClick={() => {
                    setShiftAction('close')
                    setShiftAmount('')
                    setShiftNotes('')
                    setShowShiftModal(true)
                  }}
                  disabled={shiftLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  type="button"
                >
                  <DoorClosed className="h-3.5 w-3.5" />
                  Cerrar turno
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o codigo de barras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            type="button"
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              type="button"
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {loadingProducts ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <ShoppingCart className="mb-2 h-12 w-12" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  className="relative flex flex-col items-center rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm transition-all hover:border-primary-300 hover:shadow-md active:scale-95"
                  type="button"
                >
                  {product.sellByWeight && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      <Weight className="h-3 w-3" />
                      {product.saleUnit || 'kg'}
                    </span>
                  )}
                  {product.currentStock != null && product.currentStock <= 0 && (
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Sin stock
                    </span>
                  )}
                  {product.currentStock != null && product.currentStock > 0 && product.minStock != null && product.currentStock <= product.minStock && (
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Stock bajo
                    </span>
                  )}
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="mb-2 h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-primary-50">
                      <ShoppingCart className="h-6 w-6 text-primary-300" />
                    </div>
                  )}
                  <p className="mb-1 line-clamp-2 text-xs font-medium text-gray-800">
                    {product.name}
                  </p>
                  <p className="text-sm font-bold text-primary-600">
                    {formatCurrency(product.price)}
                    {product.sellByWeight && (
                      <span className="text-xs font-normal text-gray-400">/{product.saleUnit || 'kg'}</span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart / Ticket */}
      <div className="flex w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-sm lg:w-96">
        {/* Cart header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Ticket de venta
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowObservations(!showObservations)}
                className={`rounded p-1 text-xs ${observations ? 'text-primary-600' : 'text-gray-400'} hover:bg-gray-100`}
                title="Observaciones"
                type="button"
              >
                <StickyNote className="h-4 w-4" />
              </button>
              {items.length > 0 && (
                <button
                  onClick={clear}
                  className="text-xs text-red-500 hover:text-red-700"
                  type="button"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Customer selector */}
          <div className="mt-2 relative">
            <button
              onClick={() => setShowCustomerSearch(!showCustomerSearch)}
              className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-50"
              type="button"
            >
              <User className="h-3.5 w-3.5 text-gray-400" />
              {selectedCustomer ? (
                <span className="flex-1 truncate text-gray-800">
                  {selectedCustomer.name}
                </span>
              ) : (
                <span className="flex-1 text-gray-400">
                  Cliente (opcional)
                </span>
              )}
              {customerId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCustomer(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </button>

            {showCustomerSearch && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setCustomer(customer.id)
                        setShowCustomerSearch(false)
                        setCustomerSearch('')
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                      type="button"
                    >
                      <span className="font-medium text-gray-800">
                        {customer.name}
                      </span>
                      {customer.phone && (
                        <span className="text-gray-400">{customer.phone}</span>
                      )}
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400">
                      No se encontraron clientes
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Observations */}
          {showObservations && (
            <div className="mt-2">
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observaciones de la venta..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* No-shift warning */}
        {!shiftOpen && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <DoorOpen className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-xs font-medium text-amber-700">
              Abre un turno de caja para comenzar a vender
            </p>
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-300">
              <ShoppingCart className="mb-2 h-10 w-10" />
              <p className="text-sm">Carrito vacio</p>
              <p className="mt-1 text-xs">Selecciona productos para agregar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const lineGross = item.price * item.quantity
                const discountAmt = lineGross * (item.discount / 100)
                const lineNet = lineGross - discountAmt
                return (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50 p-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {item.name}
                      </p>
                      {item.sellByWeight ? (
                        <p className="text-xs text-gray-500">
                          {item.quantity.toFixed(3)} {item.saleUnit || 'kg'} x {formatCurrency(item.price)}/{item.saleUnit || 'kg'}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.price)} c/u
                          {item.price !== item.originalPrice && (
                            <span className="ml-1 line-through text-gray-400">{formatCurrency(item.originalPrice)}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {item.sellByWeight ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const prod = products.find((p) => p.id === item.productId)
                            if (prod) setWeightProduct(prod)
                          }}
                          className="rounded bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-200"
                          type="button"
                          title="Repesar"
                        >
                          <Weight className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="flex h-6 w-6 items-center justify-center rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                          type="button"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-medium text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="flex h-6 w-6 items-center justify-center rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                          type="button"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col items-end gap-1">
                      <p className="text-xs font-semibold text-gray-900">
                        {formatCurrency(lineNet)}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-600"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Discount row */}
                  <div className="flex items-center gap-1.5 pl-0.5">
                    {editingDiscountId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={maxDiscountPct}
                          step="1"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const safeMax = Number.isFinite(maxDiscountPct) ? maxDiscountPct : 0
                              const val = Math.min(parseFloat(discountInput) || 0, safeMax)
                              updateItemDiscount(item.id, val)
                              setEditingDiscountId(null)
                            } else if (e.key === 'Escape') {
                              setEditingDiscountId(null)
                            }
                          }}
                          onBlur={() => {
                            const safeMax = Number.isFinite(maxDiscountPct) ? maxDiscountPct : 0
                            const val = Math.min(parseFloat(discountInput) || 0, safeMax)
                            updateItemDiscount(item.id, val)
                            setEditingDiscountId(null)
                          }}
                          className="w-14 rounded border border-primary-300 px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                          autoFocus
                        />
                        <span className="text-[10px] text-gray-400">%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingDiscountId(item.id)
                          setDiscountInput(String(item.discount || ''))
                        }}
                        className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                        type="button"
                        title={`Descuento (max ${maxDiscountPct}%)`}
                      >
                        <Percent className="h-2.5 w-2.5" />
                        {item.discount > 0 ? (
                          <span className="font-medium text-primary-600">-{item.discount}%</span>
                        ) : (
                          <span>Desc.</span>
                        )}
                      </button>
                    )}
                    {item.discount > 0 && editingDiscountId !== item.id && (
                      <span className="text-[10px] text-red-500">-{formatCurrency(discountAmt)}</span>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal())}</span>
            </div>
            {totalDiscount() > 0 && (
              <div className="flex justify-between text-xs text-red-500">
                <span>Descuento</span>
                <span>-{formatCurrency(totalDiscount())}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-500">
              <span>IVA</span>
              <span>{formatCurrency(tax())}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-bold text-gray-900">
              <span>Total</span>
              <span className="text-primary-600">{formatCurrency(total())}</span>
            </div>
          </div>

          {/* Payment button */}
          <button
            onClick={handleOpenPayment}
            disabled={items.length === 0 || !shiftOpen}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400"
            type="button"
          >
            <span className="flex items-center justify-center gap-2">
              <Banknote className="h-5 w-5" />
              Cobrar {items.length > 0 && formatCurrency(total())}
            </span>
          </button>

          {/* Quick single-method buttons */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                if (!shiftOpen) { toast.warning('Debes abrir un turno de caja para poder vender'); return }
                if (items.length === 0) return
                handleConfirmPayment([{ method: 'cash', amount: total() }], total())
              }}
              disabled={items.length === 0 || !shiftOpen || processing}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 px-2 py-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30"
              type="button"
            >
              <Banknote className="h-4 w-4" />
              <span className="text-[9px] font-medium">Efectivo</span>
            </button>
            <button
              onClick={() => {
                if (!shiftOpen) { toast.warning('Debes abrir un turno de caja para poder vender'); return }
                if (items.length === 0) return
                handleConfirmPayment([{ method: 'card', amount: total() }])
              }}
              disabled={items.length === 0 || !shiftOpen || processing}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 px-2 py-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30"
              type="button"
            >
              <CreditCard className="h-4 w-4" />
              <span className="text-[9px] font-medium">Tarjeta</span>
            </button>
            <button
              onClick={() => {
                if (!shiftOpen) { toast.warning('Debes abrir un turno de caja para poder vender'); return }
                if (items.length === 0) return
                handleConfirmPayment([{ method: 'transfer', amount: total() }])
              }}
              disabled={items.length === 0 || !shiftOpen || processing}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 px-2 py-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30"
              type="button"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-[9px] font-medium">Transfer.</span>
            </button>
          </div>
        </div>
      </div>

      {/* Weight Input Modal */}
      {weightProduct && (
        <WeightInputModal
          product={weightProduct}
          onConfirm={handleWeightConfirm}
          onClose={() => setWeightProduct(null)}
        />
      )}

      {/* Mixed Payment Modal */}
      {showPaymentModal && (
        <MixedPaymentModal
          total={total()}
          subtotal={subtotal()}
          tax={tax()}
          customerId={customerId}
          customerName={selectedCustomer?.name || null}
          customerCreditLimit={parseFloat(String(selectedCustomer?.creditLimit ?? '0'))}
          onConfirm={handleConfirmPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Corte X Modal */}
      {showCorteX && shiftPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowCorteX(false)}
              className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-1 text-lg font-semibold text-gray-900">Corte X</h3>
            <p className="mb-4 text-xs text-gray-500">Vista previa del turno actual (sin cerrar)</p>

            {shiftPreview.registerName && (
              <p className="mb-3 text-sm font-medium text-primary-700">Caja: {shiftPreview.registerName}</p>
            )}

            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fondo inicial</span>
                <span className="font-mono font-medium">{formatCurrency(shiftPreview.openingAmount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ventas efectivo</span>
                <span className="font-mono font-medium">{formatCurrency(shiftPreview.totalCashPayments)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ventas tarjeta</span>
                <span className="font-mono font-medium">{formatCurrency(shiftPreview.totalCardPayments)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ventas transferencia</span>
                <span className="font-mono font-medium">{formatCurrency(shiftPreview.totalTransferPayments)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Depositos</span>
                <span className="font-mono font-medium text-green-600">+{formatCurrency(shiftPreview.totalDeposits)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Retiros</span>
                <span className="font-mono font-medium text-red-600">-{formatCurrency(shiftPreview.totalWithdrawals)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total ventas</span>
                <span className="font-mono font-bold">{formatCurrency(shiftPreview.totalSales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transacciones</span>
                <span className="font-mono font-bold">{shiftPreview.transactionsCount}</span>
              </div>
              <div className="border-t-2 border-gray-300 pt-2" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-gray-900">Efectivo esperado</span>
                <span className="font-mono text-primary-600">{formatCurrency(shiftPreview.expectedAmount)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  const expected = shiftPreview.expectedAmount
                  const leave = parseFloat(withdrawalLeave) || 500
                  const suggested = Math.max(0, expected - leave)
                  setWithdrawalAmount(suggested > 0 ? suggested.toFixed(2) : '')
                  setShowPartialWithdrawal(true)
                }}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
                type="button"
              >
                Retiro parcial
              </button>
              <button
                onClick={() => setShowCorteX(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                type="button"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Withdrawal Modal */}
      {showPartialWithdrawal && shiftPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowPartialWithdrawal(false)}
              disabled={withdrawalSubmitting}
              className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-1 text-lg font-semibold text-gray-900">Retiro parcial</h3>
            <p className="mb-4 text-xs text-gray-500">
              Efectivo esperado: <span className="font-mono font-bold text-primary-600">{formatCurrency(shiftPreview.expectedAmount)}</span>
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Dejar en caja</label>
              <input
                type="number"
                step="50"
                min="0"
                value={withdrawalLeave}
                onChange={(e) => {
                  setWithdrawalLeave(e.target.value)
                  const leave = parseFloat(e.target.value) || 0
                  const suggested = Math.max(0, shiftPreview.expectedAmount - leave)
                  setWithdrawalAmount(suggested > 0 ? suggested.toFixed(2) : '')
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-right font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <div className="mt-1 flex gap-2">
                {[200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setWithdrawalLeave(String(amt))
                      const suggested = Math.max(0, shiftPreview.expectedAmount - amt)
                      setWithdrawalAmount(suggested > 0 ? suggested.toFixed(2) : '')
                    }}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    type="button"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Monto a retirar</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-right font-mono text-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Esperado en caja</span>
                <span className="font-mono font-medium">{formatCurrency(shiftPreview.expectedAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retiro</span>
                <span className="font-mono font-medium text-red-600">-{formatCurrency(parseFloat(withdrawalAmount) || 0)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-700">
                <span>Quedaria en caja</span>
                <span className="font-mono">{formatCurrency(shiftPreview.expectedAmount - (parseFloat(withdrawalAmount) || 0))}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPartialWithdrawal(false)}
                disabled={withdrawalSubmitting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const amount = parseFloat(withdrawalAmount)
                  if (isNaN(amount) || amount <= 0) {
                    toast.error('Ingresa un monto valido')
                    return
                  }
                  if (amount > shiftPreview.expectedAmount) {
                    toast.error('El retiro excede el efectivo esperado')
                    return
                  }
                  setWithdrawalSubmitting(true)
                  try {
                    await createMovement({
                      type: 'withdrawal',
                      amount,
                      reason: 'expense',
                      notes: `Retiro parcial - dejar $${(shiftPreview.expectedAmount - amount).toFixed(2)} en caja`,
                    })
                    toast.success('Retiro parcial registrado')
                    setShowPartialWithdrawal(false)
                    setShowCorteX(false)
                    await fetchShiftPreview()
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error || 'Error al registrar retiro')
                  } finally {
                    setWithdrawalSubmitting(false)
                  }
                }}
                disabled={withdrawalSubmitting || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                type="button"
              >
                {withdrawalSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Retirando...
                  </span>
                ) : (
                  'Retirar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowShiftModal(false)}
              disabled={shiftLoading}
              className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {shiftAction === 'open' ? 'Abrir turno' : 'Cerrar turno'}
            </h3>

            {/* Register selector (only when opening) */}
            {shiftAction === 'open' && myRegisters.length > 0 && (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Caja
                </label>
                {loadingRegisters ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando cajas...
                  </div>
                ) : (
                  <select
                    value={selectedRegisterId}
                    onChange={(e) => setSelectedRegisterId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">Selecciona una caja</option>
                    {myRegisters.map((reg) => (
                      <option key={reg.id} value={reg.id} disabled={!!reg.currentShift}>
                        {reg.name}{reg.currentShift ? ` (en uso por ${reg.currentShift.userName})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {shiftAction === 'open' && myRegisters.length === 0 && !loadingRegisters && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                No hay cajas configuradas. El turno se abrira sin caja asignada.
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="shift-amount"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {shiftAction === 'open'
                  ? 'Fondo de caja inicial'
                  : 'Efectivo en caja'}
              </label>
              <input
                id="shift-amount"
                type="number"
                step="0.01"
                min="0"
                value={shiftAmount}
                onChange={(e) => setShiftAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-right font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                autoFocus
              />
            </div>

            {shiftAction === 'close' && (
              <div className="mb-4">
                <label
                  htmlFor="shift-notes"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Notas (opcional)
                </label>
                <textarea
                  id="shift-notes"
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Observaciones del turno..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowShiftModal(false)}
                disabled={shiftLoading}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleShiftAction}
                disabled={shiftLoading || !shiftAmount}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="button"
              >
                {shiftLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {shiftAction === 'open' ? 'Abriendo...' : 'Cerrando...'}
                  </span>
                ) : shiftAction === 'open' ? (
                  'Abrir turno'
                ) : (
                  'Cerrar turno'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
