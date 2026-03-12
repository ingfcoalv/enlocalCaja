/**
 * Exponential backoff for sync retries.
 * Delay = min(15*60, 5 * 2^(attempt-2)) seconds
 *
 * attempt 1 → 5s
 * attempt 2 → 5s
 * attempt 3 → 10s
 * attempt 4 → 20s
 * attempt 5 → 40s
 * attempt 6 → 80s
 * attempt 7 → 160s
 * attempt 8 → 320s (~5min)
 * attempt 9+ → 900s (15min max)
 */

const MAX_DELAY_SECONDS = 15 * 60 // 15 minutes

export function calculateNextRetry(attempts: number): Date {
  const delaySec = Math.min(MAX_DELAY_SECONDS, 5 * Math.pow(2, Math.max(0, attempts - 2)))
  return new Date(Date.now() + delaySec * 1000)
}

export function calculateDelayMs(attempts: number): number {
  const delaySec = Math.min(MAX_DELAY_SECONDS, 5 * Math.pow(2, Math.max(0, attempts - 2)))
  return delaySec * 1000
}
