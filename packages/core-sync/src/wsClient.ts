/**
 * WebSocket client for real-time sync communication.
 * WS /api/v1/pos-sync/ws/{branch_id}?token={terminal_token}
 *
 * Inbound message types:
 *   - "new_order"  → pending orders sent on connect (order data in msg.order)
 *   - "order.new"  → real-time orders via envelope (order data in msg.order, has idempotency_key)
 *   - "delivery_status_update" → driver/marketplace status changes
 *   - "sync_trigger" → force HTTP pull
 *
 * Outbound: order_status, ping (string "ping" → expects string "pong").
 * Heartbeat: send "ping" every 30s. Reconnection with exponential backoff.
 */

import WebSocket from 'ws'
import type { SyncConfig, WsMessage } from './types'
import { calculateDelayMs } from './backoff'

export interface WsClientCallbacks {
  onNewOrder?: (data: Record<string, unknown>) => void
  onDeliveryStatusUpdate?: (data: Record<string, unknown>) => void
  onSyncTrigger?: () => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export class WsClient {
  private config: SyncConfig
  private callbacks: WsClientCallbacks
  private ws: WebSocket | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private _connected = false
  private _stopped = false
  /** Track processed idempotency keys to prevent duplicate handling */
  private processedKeys = new Set<string>()
  private readonly MAX_PROCESSED_KEYS = 500

  constructor(config: SyncConfig, callbacks: WsClientCallbacks) {
    this.config = config
    this.callbacks = callbacks
  }

  get connected(): boolean {
    return this._connected
  }

  start(): void {
    this._stopped = false
    this.connect()
  }

  stop(): void {
    this._stopped = true
    this.cleanup()
  }

  /**
   * Send order_status message outbound.
   */
  sendOrderStatus(data: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const msg = {
      type: 'order_status',
      ...data,
    }
    this.ws.send(JSON.stringify(msg), (err) => {
      if (err) console.error('[ws-client] Failed to send order_status:', err.message)
    })
  }

  private connect(): void {
    if (this._stopped) return

    const token = this.config.getTerminalToken()
    const wsUrl = this.config.cloudApiUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')

    const fullUrl = `${wsUrl}/api/v1/pos-sync/ws/${this.config.branchId}?token=${encodeURIComponent(token)}`

    try {
      // Auth is via query param token only — no extra headers needed
      this.ws = new WebSocket(fullUrl)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      this._connected = true
      this.reconnectAttempt = 0
      this.startPing()
      this.callbacks.onConnect?.()
    })

    this.ws.on('message', (raw) => {
      const rawStr = raw.toString()

      // Handle plain-text pong from server
      if (rawStr === 'pong') return

      try {
        const msg = JSON.parse(rawStr) as WsMessage

        switch (msg.type) {
          case 'new_order': {
            // Pending orders sent on connect — order data in msg.order
            const orderData = msg.order ?? msg.data ?? {}
            if (orderData && (orderData as any).id) {
              this.callbacks.onNewOrder?.(orderData as Record<string, unknown>)
            }
            break
          }

          case 'order.new': {
            // Real-time envelope — has idempotency_key for dedup
            const idempotencyKey = msg.idempotency_key
            if (idempotencyKey) {
              if (this.processedKeys.has(idempotencyKey)) {
                console.log(`[ws-client] Duplicate idempotency_key ${idempotencyKey}, skipping`)
                break
              }
              this.processedKeys.add(idempotencyKey)
              // Cap the set size
              if (this.processedKeys.size > this.MAX_PROCESSED_KEYS) {
                const first = this.processedKeys.values().next().value
                if (first) this.processedKeys.delete(first)
              }
            }

            const orderData = msg.order ?? {}
            if (orderData && (orderData as any).id) {
              this.callbacks.onNewOrder?.(orderData as Record<string, unknown>)
            }
            break
          }

          case 'delivery_status_update':
            // Fields are at top level: order_id, status, delivery_status, etc.
            this.callbacks.onDeliveryStatusUpdate?.({
              order_id: msg.order_id,
              order_number: msg.order_number,
              status: msg.status,
              delivery_status: msg.delivery_status,
              updated_at: msg.updated_at,
            })
            break

          case 'pong':
            // Server responded to our ping (JSON format)
            break

          case 'sync_trigger':
            this.callbacks.onSyncTrigger?.()
            break
        }
      } catch {
        console.error('[ws-client] Invalid message:', rawStr.slice(0, 200))
      }
    })

    this.ws.on('close', () => {
      this._connected = false
      this.stopPing()
      this.callbacks.onDisconnect?.()
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      console.error('[ws-client] Error:', err.message)
    })
  }

  private startPing(): void {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Cloud expects plain string "ping", responds with plain string "pong"
        this.ws.send('ping')
      }
    }, 30_000)
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect(): void {
    if (this._stopped) return
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.reconnectAttempt++
    const delay = calculateDelayMs(this.reconnectAttempt)

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private cleanup(): void {
    this.stopPing()

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.removeAllListeners()
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }

    this._connected = false
  }
}
