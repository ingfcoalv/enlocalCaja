// @enlocal/core-sync — Sincronización con la nube TodoEnLocal

export { SyncEngine } from './syncEngine'
export { pullFromCloud } from './pullService'
export { pushToCloud } from './pushService'
export { WsClient } from './wsClient'
export { HealthChecker } from './healthChecker'
export { QueueManager } from './queueManager'
export { calculateNextRetry, calculateDelayMs } from './backoff'
export {
  buildPriceListPayload,
  buildCategoryPayload,
  buildProductPayload,
  buildCustomerPayload,
  buildSalePayload,
  buildRegisterPayload,
  buildCashierPayload,
  buildCashMovementPayload,
  buildShiftClosePayload,
} from './payloadBuilder'

export type { PriceListEntry } from './payloadBuilder'

export type {
  SyncConfig,
  SyncStatus,
  SyncTrigger,
  SyncEngineStatus,
  PushPayload,
  PushResponse,
  PushResult,
  PullResponse,
  PullResult,
  CloudProduct,
  CloudCategory,
  CloudCashier,
  CloudClient,
  CloudRegister,
  WsMessage,
  WsMessageType,
} from './types'

export type { WsClientCallbacks } from './wsClient'
export type { QueueEntry, QueueStats } from './queueManager'
export type { ConnectivityStatus, StatusChangeCallback } from './healthChecker'
