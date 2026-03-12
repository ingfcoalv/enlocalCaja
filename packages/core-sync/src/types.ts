/**
 * Core Sync types — TodoEnLocal API integration
 */

export interface SyncConfig {
  cloudApiUrl: string
  branchId: string
  syncIntervalMs?: number

  // Injected getters — avoid tight coupling with core-license
  getTerminalToken: () => string
  getFingerprint: () => string

  // Injected PIN hasher — avoid coupling core-sync with bcryptjs
  hashPin?: (pin: string) => Promise<string>
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export type SyncTrigger =
  | 'startup'
  | 'periodic'
  | 'sale_close'
  | 'shift_close'
  | 'register_change'
  | 'cashier_change'
  | 'reconnect'
  | 'manual'

// ─── Cloud Entity Types (from API response) ───────────

export interface CloudProduct {
  id: string
  name: string
  sku: string
  description_short?: string
  pricing: { price: number; cost: number; wholesale_price?: number }
  subcategory_id: string
  subcategory?: string
  category?: string
  sat_code?: string
  sat_unit?: string
  tax_config?: { iva_rate: number; ieps_rate: number; iva_included: boolean }
  stock_min?: number
  is_active: boolean
  is_wholesale: boolean
  hidden_from_marketplace: boolean
  source: string
  created_at: string
  updated_at: string
}

export interface CloudCategory {
  id: string
  name: string
  parent_category_id?: string
  order: number
  is_active: boolean
  source: string
  created_at: string
  updated_at: string
}

export interface CloudCashier {
  id: string
  name: string
  pin: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CloudClient {
  id: string
  rfc: string
  razon_social: string
  regimen_fiscal?: string
  uso_cfdi?: string
  domicilio_fiscal?: string
  email?: string
  phone?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CloudRegister {
  id: string
  name: string
  terminal_hash?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Push Types ─────────────────────────────────────────

export interface PushPayload {
  price_lists?: Record<string, unknown>[]
  categories?: Record<string, unknown>[]
  products?: Record<string, unknown>[]
  product_updates?: Record<string, unknown>[]
  sales?: Record<string, unknown>[]
  customers?: Record<string, unknown>[]
  shift_closes?: Record<string, unknown>[]
  registers?: Record<string, unknown>[]
  cashiers?: Record<string, unknown>[]
  cash_movements?: Record<string, unknown>[]
}

export interface PushResponse {
  success: boolean
  id_mappings: Array<{
    entity_type: string
    local_id: string
    cloud_id: string
  }>
  errors?: Array<{
    entity_type: string
    local_id: string
    error: string
  }>
  server_time: string
}

// ─── Pull Types ─────────────────────────────────────────

export interface PullResponse {
  products: CloudProduct[]
  categories: CloudCategory[]
  cashiers: CloudCashier[]
  clients: CloudClient[]
  registers?: CloudRegister[]
  business_config?: Record<string, unknown>
  branch?: Record<string, unknown>
  server_time: string
}

export interface PullResult {
  success: boolean
  recordsUpdated: number
  lastPullTimestamp: string
  errors?: string[]
}

export interface PushResult {
  success: boolean
  recordsPushed: number
  mappingsSaved: number
  lastPushTimestamp: string
  errors?: string[]
}

// ─── WebSocket Types ────────────────────────────────────

export type WsMessageType = 'new_order' | 'order.new' | 'order_status' | 'delivery_status_update' | 'ping' | 'pong' | 'sync_trigger'

export interface WsMessage {
  type: WsMessageType
  data?: Record<string, unknown>
  timestamp?: string
  // Envelope fields for order.new messages from cloud
  order?: Record<string, unknown>
  msg_id?: string
  source?: string
  idempotency_key?: string
  payload?: Record<string, unknown>
  ts?: string
  // delivery_status_update top-level fields
  order_id?: string
  order_number?: string
  status?: string
  delivery_status?: string
  updated_at?: string
}

// ─── Sync Engine Status ─────────────────────────────────

export interface SyncEngineStatus {
  status: SyncStatus
  lastSyncAt: string | null
  lastError: string | null
  isCloudReachable: boolean
  queueStats: {
    pending: number
    synced: number
    failed: number
  }
}
