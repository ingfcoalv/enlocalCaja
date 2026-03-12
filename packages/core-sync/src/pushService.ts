/**
 * Push service — reads sync_queue and pushes to cloud API.
 * POST /api/v2/pos-sync/push?token={terminal_token}
 * Payload structured by entity type.
 * Saves id_mappings from response.
 */

import type { Pool } from 'pg'
import type { SyncConfig, PushPayload, PushResponse, PushResult } from './types'
import { QueueManager, type QueueEntry } from './queueManager'

// Entity push order: registers → price_lists → categories → products → product_updates → customers → cashiers → sales → shift_close
const ENTITY_ORDER = ['register', 'price_list', 'category', 'product', 'product_update', 'customer', 'cashier', 'sale', 'cash_movement', 'shift_close'] as const

function groupByEntityType(entries: QueueEntry[]): PushPayload {
  const payload: PushPayload = {}

  for (const entry of entries) {
    // Flat payload: local_id at same level as entity fields (no wrapper)
    const item = { local_id: entry.entityLocalId, ...entry.payload }

    switch (entry.entityType) {
      case 'price_list':
        (payload.price_lists ??= []).push(item)
        break
      case 'category':
        (payload.categories ??= []).push(item)
        break
      case 'product':
        (payload.products ??= []).push(item)
        break
      case 'product_update':
        (payload.product_updates ??= []).push(item)
        break
      case 'sale':
        (payload.sales ??= []).push(item)
        break
      case 'customer':
        (payload.customers ??= []).push(item)
        break
      case 'shift_close':
        (payload.shift_closes ??= []).push(item)
        break
      case 'register':
        (payload.registers ??= []).push(item)
        break
      case 'cashier':
        (payload.cashiers ??= []).push(item)
        break
      case 'cash_movement':
        (payload.cash_movements ??= []).push(item)
        break
    }
  }

  return payload
}

export async function pushToCloud(db: Pool, config: SyncConfig): Promise<PushResult> {
  const queueManager = new QueueManager(db)

  // Read ready entries from sync_queue
  const entries = await queueManager.dequeueReady(500)

  if (entries.length === 0) {
    return {
      success: true,
      recordsPushed: 0,
      mappingsSaved: 0,
      lastPushTimestamp: new Date().toISOString(),
    }
  }

  // Sort entries by entity order
  const sorted = [...entries].sort((a, b) => {
    const aIdx = ENTITY_ORDER.indexOf(a.entityType as any)
    const bIdx = ENTITY_ORDER.indexOf(b.entityType as any)
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
  })

  const payload = groupByEntityType(sorted)
  const token = config.getTerminalToken()

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(
      `${config.cloudApiUrl}/api/v2/pos-sync/push?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: {
          'X-Terminal-Token': token,
          'X-Hardware-Fingerprint': config.getFingerprint(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      }
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    // Mark all entries as failed with backoff
    const errorMsg = `Push failed: ${response.status} ${response.statusText}`
    for (const entry of entries) {
      await queueManager.markFailed(entry.id, errorMsg)
    }
    throw new Error(errorMsg)
  }

  const pushResponse = (await response.json()) as PushResponse

  // Mark successful entries as synced
  const successIds = entries.map((e) => e.id)
  // Remove IDs that had errors
  const errorLocalIds = new Set(pushResponse.errors?.map((e) => e.local_id) ?? [])
  const syncedIds = successIds.filter(
    (id) => !errorLocalIds.has(entries.find((e) => e.id === id)?.entityLocalId ?? '')
  )

  await queueManager.markSynced(syncedIds)

  // Mark errored entries as failed
  if (pushResponse.errors) {
    for (const err of pushResponse.errors) {
      const entry = entries.find(
        (e) => e.entityLocalId === err.local_id && e.entityType === err.entity_type
      )
      if (entry) {
        await queueManager.markFailed(entry.id, err.error)
      }
    }
  }

  // Save id_mappings and update cloud_id on local entities
  let mappingsSaved = 0
  const ENTITY_TABLE_MAP: Record<string, string> = {
    price_list: 'price_lists',
    product: 'products',
    category: 'categories',
    customer: 'customers',
    register: 'pos_registers',
  }

  if (pushResponse.id_mappings?.length) {
    for (const mapping of pushResponse.id_mappings) {
      await db.query(
        `INSERT INTO id_mappings (entity_type, local_id, cloud_id, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT ON CONSTRAINT uq_id_mappings_entity_local
         DO UPDATE SET cloud_id = $3`,
        [mapping.entity_type, mapping.local_id, mapping.cloud_id]
      )

      // Update cloud_id on the local entity table
      const table = ENTITY_TABLE_MAP[mapping.entity_type]
      if (table) {
        try {
          await db.query(
            `UPDATE ${table} SET cloud_id = $1 WHERE id = $2`,
            [mapping.cloud_id, mapping.local_id]
          )
        } catch {
          // Non-critical: mapping is saved, cloud_id update is best-effort
        }
      }

      mappingsSaved++
    }
  }

  // Update sync_state
  await db.query(
    `INSERT INTO sync_state (key, value, updated_at) VALUES ('last_push_timestamp', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [pushResponse.server_time]
  )

  return {
    success: true,
    recordsPushed: syncedIds.length,
    mappingsSaved,
    lastPushTimestamp: pushResponse.server_time,
  }
}
