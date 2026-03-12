/**
 * QueueManager — CRUD for sync_queue table.
 * Uses raw SQL for pg Pool compatibility.
 */

import type { Pool } from 'pg'
import { calculateNextRetry } from './backoff'

export interface QueueEntry {
  id: string
  entityType: string
  entityLocalId: string
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'synced' | 'failed'
  errorMessage: string | null
  nextRetryAt: string | null
  createdAt: string
  updatedAt: string
}

export interface QueueStats {
  pending: number
  synced: number
  failed: number
  total: number
}

export class QueueManager {
  private db: Pool

  constructor(db: Pool) {
    this.db = db
  }

  /**
   * Add an entity to the sync queue.
   */
  async enqueue(entityType: string, entityLocalId: string, payload: Record<string, unknown>): Promise<string> {
    const result = await this.db.query(
      `INSERT INTO sync_queue (entity_type, entity_local_id, payload, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING id`,
      [entityType, entityLocalId, JSON.stringify(payload)]
    )
    return result.rows[0].id
  }

  /**
   * Get entries ready to sync (pending + nextRetryAt in the past or null).
   */
  async dequeueReady(limit = 100): Promise<QueueEntry[]> {
    const result = await this.db.query(
      `SELECT id, entity_type, entity_local_id, payload, attempts, status,
              error_message, next_retry_at, created_at, updated_at
       FROM sync_queue
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    )

    return result.rows.map((row: any) => ({
      id: row.id,
      entityType: row.entity_type,
      entityLocalId: row.entity_local_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      attempts: row.attempts,
      status: row.status,
      errorMessage: row.error_message,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Mark entries as successfully synced.
   */
  async markSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.db.query(
      `UPDATE sync_queue
       SET status = 'synced', updated_at = NOW()
       WHERE id = ANY($1)`,
      [ids]
    )
  }

  /**
   * Mark an entry as failed with backoff retry.
   */
  async markFailed(id: string, error: string, nextRetryAt?: Date): Promise<void> {
    // Get current attempts to calculate backoff
    const current = await this.db.query(
      `SELECT attempts FROM sync_queue WHERE id = $1`,
      [id]
    )
    const attempts = (current.rows[0]?.attempts ?? 0) + 1
    const retry = nextRetryAt ?? calculateNextRetry(attempts)

    await this.db.query(
      `UPDATE sync_queue
       SET status = 'pending',
           attempts = $2,
           error_message = $3,
           next_retry_at = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [id, attempts, error, retry.toISOString()]
    )
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(): Promise<QueueStats> {
    const result = await this.db.query(
      `SELECT status, COUNT(*)::int as count
       FROM sync_queue
       GROUP BY status`
    )

    const stats: QueueStats = { pending: 0, synced: 0, failed: 0, total: 0 }
    for (const row of result.rows) {
      if (row.status === 'pending') stats.pending = row.count
      else if (row.status === 'synced') stats.synced = row.count
      else if (row.status === 'failed') stats.failed = row.count
    }
    stats.total = stats.pending + stats.synced + stats.failed

    return stats
  }
}
