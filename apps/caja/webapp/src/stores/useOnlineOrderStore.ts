import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface OnlineOrderItem {
  id: string
  product_id: string | null
  description: string
  quantity: string
  unit_price: string
  amount: string
  product_name: string | null
}

export interface OnlineOrder {
  id: string
  cloud_id: string | null
  cloud_status: string
  delivery_type_cloud: string | null
  customer_name: string | null
  customer_phone: string | null
  subtotal: string
  tax: string
  total: string
  observations: string | null
  items: OnlineOrderItem[]
  created_at: string
}

interface OnlineOrderStore {
  orders: OnlineOrder[]
  loading: boolean
  fetchOrders: () => Promise<void>
  updateCloudStatus: (id: string, status: string) => Promise<void>
  updateFromSocket: () => void
}

export const useOnlineOrderStore = create<OnlineOrderStore>((set, get) => ({
  orders: [],
  loading: false,

  fetchOrders: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/api/online-orders')
      set({ orders: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  updateCloudStatus: async (id: string, status: string) => {
    await api.put(`/api/online-orders/${id}/status`, { status })
    await get().fetchOrders()
  },

  updateFromSocket: () => {
    get().fetchOrders()
  },
}))
