/**
 * SyncEngine — orchestrates pull, push, health checking, and WebSocket.
 * EventEmitter pattern: sync:started, sync:completed, sync:error, connectivity:changed
 */

import type { Pool } from 'pg'
import type { SyncConfig, SyncStatus, SyncTrigger, SyncEngineStatus } from './types'
import { pullFromCloud } from './pullService'
import { pushToCloud } from './pushService'
import { HealthChecker } from './healthChecker'
import { QueueManager } from './queueManager'
import { WsClient, type WsClientCallbacks } from './wsClient'

type SyncEvent =
  | 'sync:started'
  | 'sync:completed'
  | 'sync:error'
  | 'connectivity:changed'

type SyncEventCallback = (data?: any) => void

export class SyncEngine {
  private db: Pool
  private config: SyncConfig
  private healthChecker: HealthChecker
  private queueManager: QueueManager
  private wsClient: WsClient | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private _status: SyncStatus = 'idle'
  private _lastSyncAt: string | null = null
  private _lastError: string | null = null
  private listeners: Map<SyncEvent, SyncEventCallback[]> = new Map()

  constructor(db: Pool, config: SyncConfig) {
    this.db = db
    this.config = {
      syncIntervalMs: 5 * 60 * 1000, // 5 minutes default
      ...config,
    }
    this.healthChecker = new HealthChecker(config.cloudApiUrl)
    this.queueManager = new QueueManager(db)
  }

  get status(): SyncStatus {
    return this._status
  }

  // ─── Event Emitter ────────────────────────────────────

  on(event: SyncEvent, callback: SyncEventCallback): () => void {
    const callbacks = this.listeners.get(event) ?? []
    callbacks.push(callback)
    this.listeners.set(event, callbacks)
    return () => {
      const cbs = this.listeners.get(event) ?? []
      this.listeners.set(event, cbs.filter((cb) => cb !== callback))
    }
  }

  private emit(event: SyncEvent, data?: any): void {
    const callbacks = this.listeners.get(event) ?? []
    for (const cb of callbacks) {
      try { cb(data) } catch { /* ignore listener errors */ }
    }
  }

  // ─── Lifecycle ────────────────────────────────────────

  async start(): Promise<void> {
    // Start health checker
    this.healthChecker.onStatusChange((status) => {
      this.emit('connectivity:changed', { online: status === 'online' })

      if (status === 'online') {
        // Trigger sync on reconnect
        this.sync('reconnect').catch(() => {})
      }
    })
    await this.healthChecker.start()

    // Start WebSocket
    this.startWebSocket()

    // Initial sync
    await this.sync('startup').catch(() => {})

    // Periodic sync
    this.intervalId = setInterval(
      () => this.sync('periodic').catch(() => {}),
      this.config.syncIntervalMs!
    )
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.healthChecker.stop()
    this.wsClient?.stop()
    this._status = 'idle'
  }

  /**
   * Run a sync cycle (pull + push).
   */
  async sync(trigger: SyncTrigger = 'manual'): Promise<void> {
    if (this._status === 'syncing') return
    if (!this.healthChecker.isOnline()) {
      this._status = 'offline'
      return
    }

    this._status = 'syncing'
    this.emit('sync:started', { trigger })

    try {
      // Pull first, then push
      await pullFromCloud(this.db, this.config)
      await pushToCloud(this.db, this.config)

      this._status = 'idle'
      this._lastSyncAt = new Date().toISOString()
      this._lastError = null
      this.emit('sync:completed', { trigger, timestamp: this._lastSyncAt })
    } catch (err: any) {
      this._status = 'error'
      this._lastError = err.message
      this.emit('sync:error', { trigger, error: err.message })
      console.error('[sync-engine] Sync failed:', err)
    }
  }

  /**
   * Trigger a sync from external callers.
   */
  triggerSync(trigger: SyncTrigger = 'manual'): void {
    this.sync(trigger).catch(() => {})
  }

  /**
   * Enqueue an entity for sync.
   */
  async enqueue(entityType: string, entityLocalId: string, payload: Record<string, unknown>): Promise<void> {
    await this.queueManager.enqueue(entityType, entityLocalId, payload)
  }

  /**
   * Get current sync engine status.
   */
  async getStatus(): Promise<SyncEngineStatus> {
    const queueStats = await this.queueManager.getQueueStats()

    return {
      status: this._status,
      lastSyncAt: this._lastSyncAt,
      lastError: this._lastError,
      isCloudReachable: this.healthChecker.isOnline(),
      queueStats: {
        pending: queueStats.pending,
        synced: queueStats.synced,
        failed: queueStats.failed,
      },
    }
  }

  /**
   * Send order status update to cloud via WebSocket.
   */
  sendOrderStatus(data: Record<string, unknown>): void {
    this.wsClient?.sendOrderStatus(data)
  }

  // ─── Private ──────────────────────────────────────────

  private startWebSocket(): void {
    const wsCallbacks: WsClientCallbacks = {
      onNewOrder: (data) => {
        this.emit('sync:completed', { trigger: 'ws_new_order', data })
      },
      onDeliveryStatusUpdate: (data) => {
        this.emit('sync:completed', { trigger: 'ws_delivery_status_update', data })
      },
      onSyncTrigger: () => {
        this.triggerSync('reconnect')
      },
      onConnect: () => {
        this.emit('connectivity:changed', { online: true, ws: true })
      },
      onDisconnect: () => {
        this.emit('connectivity:changed', { online: this.healthChecker.isOnline(), ws: false })
      },
    }

    this.wsClient = new WsClient(this.config, wsCallbacks)
    this.wsClient.start()
  }
}
