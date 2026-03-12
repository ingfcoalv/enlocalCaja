import { create } from 'zustand'

const CART_STORAGE_KEY = 'enlocal_cart'

export interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  originalPrice: number
  quantity: number
  discount: number // percentage 0-100
  taxRate: number
  sellByWeight: boolean
  saleUnit: string | null
}

interface CartState {
  items: CartItem[]
  customerId: string | null
  observations: string
  addItem: (product: { id: string; name: string; price: number; taxRate?: number; sellByWeight?: boolean; saleUnit?: string | null }, effectivePrice?: number, discount?: number) => void
  addWeightItem: (product: { id: string; name: string; price: number; taxRate?: number; saleUnit?: string | null }, quantity: number, effectivePrice?: number, discount?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  updateItemPrice: (id: string, price: number) => void
  updateItemDiscount: (id: string, discount: number) => void
  setCustomer: (id: string | null) => void
  setObservations: (text: string) => void
  clear: () => void
  subtotal: () => number
  tax: () => number
  total: () => number
  totalDiscount: () => number
}

function loadCart(): { items: CartItem[]; customerId: string | null; observations: string } {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(CART_STORAGE_KEY) : null
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        customerId: parsed.customerId || null,
        observations: parsed.observations || '',
      }
    }
  } catch { /* ignore */ }
  return { items: [], customerId: null, observations: '' }
}

function saveCart(state: { items: CartItem[]; customerId: string | null; observations: string }) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      items: state.items,
      customerId: state.customerId,
      observations: state.observations,
    }))
  } catch { /* localStorage may be full */ }
}

const initial = loadCart()

export const useCartStore = create<CartState>((set, get) => ({
  items: initial.items,
  customerId: initial.customerId,
  observations: initial.observations,

  addItem: (product, effectivePrice, discount) => {
    // For weight-based products, do NOT auto-add — caller should use addWeightItem
    if (product.sellByWeight) return

    set((state) => {
      const existing = state.items.find((item) => item.productId === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        }
      }
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        name: product.name,
        price: effectivePrice ?? product.price,
        originalPrice: product.price,
        quantity: 1,
        discount: discount ?? 0,
        taxRate: product.taxRate ?? 0.16,
        sellByWeight: false,
        saleUnit: null,
      }
      return { items: [...state.items, newItem] }
    })
  },

  addWeightItem: (product, quantity, effectivePrice, discount) => {
    set((state) => {
      // If product already in cart, replace quantity (don't sum)
      const existing = state.items.find((item) => item.productId === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity }
              : item
          ),
        }
      }
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        name: product.name,
        price: effectivePrice ?? product.price,
        originalPrice: product.price,
        quantity,
        discount: discount ?? 0,
        taxRate: product.taxRate ?? 0.16,
        sellByWeight: true,
        saleUnit: product.saleUnit || 'kg',
      }
      return { items: [...state.items, newItem] }
    })
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }))
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id)
      return
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, quantity } : item
      ),
    }))
  },

  updateItemPrice: (id, price) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, price } : item
      ),
    }))
  },

  updateItemDiscount: (id, discount) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, discount: Math.max(0, Math.min(100, discount)) } : item
      ),
    }))
  },

  setCustomer: (id) => {
    set({ customerId: id })
  },

  setObservations: (text) => {
    set({ observations: text })
  },

  clear: () => {
    set({ items: [], customerId: null, observations: '' })
  },

  subtotal: () => {
    const { items } = get()
    const raw = items.reduce((sum, item) => {
      const lineGross = item.price * item.quantity
      const discountAmt = lineGross * (item.discount / 100)
      const lineNet = lineGross - discountAmt
      const base = item.taxRate > 0 ? lineNet / (1 + item.taxRate) : lineNet
      return sum + base
    }, 0)
    return Math.round(raw * 100) / 100
  },

  tax: () => {
    const { items } = get()
    const raw = items.reduce((sum, item) => {
      const lineGross = item.price * item.quantity
      const discountAmt = lineGross * (item.discount / 100)
      const lineNet = lineGross - discountAmt
      const base = item.taxRate > 0 ? lineNet / (1 + item.taxRate) : lineNet
      return sum + (lineNet - base)
    }, 0)
    return Math.round(raw * 100) / 100
  },

  total: () => {
    const { items } = get()
    return Math.round(items.reduce((sum, item) => {
      const lineGross = item.price * item.quantity
      const discountAmt = lineGross * (item.discount / 100)
      return sum + (lineGross - discountAmt)
    }, 0) * 100) / 100
  },

  totalDiscount: () => {
    const { items } = get()
    return Math.round(items.reduce((sum, item) => {
      const lineGross = item.price * item.quantity
      return sum + lineGross * (item.discount / 100)
    }, 0) * 100) / 100
  },
}))

// Persist cart to localStorage on every change
useCartStore.subscribe((state) => {
  saveCart({ items: state.items, customerId: state.customerId, observations: state.observations })
})
