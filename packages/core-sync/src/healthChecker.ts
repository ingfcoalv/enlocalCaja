/**
 * HealthChecker — polls cloud /health endpoint every 30s
 * to detect online/offline state.
 */

export type ConnectivityStatus = 'online' | 'offline' | 'unknown'
export type StatusChangeCallback = (status: ConnectivityStatus) => void

export class HealthChecker {
  private cloudApiUrl: string
  private intervalMs: number
  private intervalId: ReturnType<typeof setInterval> | null = null
  private _status: ConnectivityStatus = 'unknown'
  private listeners: StatusChangeCallback[] = []

  constructor(cloudApiUrl: string, intervalMs = 30_000) {
    this.cloudApiUrl = cloudApiUrl
    this.intervalMs = intervalMs
  }

  get status(): ConnectivityStatus {
    return this._status
  }

  isOnline(): boolean {
    return this._status === 'online'
  }

  onStatusChange(cb: StatusChangeCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  async start(): Promise<void> {
    // Initial check
    await this.check()

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.check().catch(() => {})
    }, this.intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async check(): Promise<void> {
    const previous = this._status

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const response = await fetch(`${this.cloudApiUrl}/health`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      this._status = response.ok ? 'online' : 'offline'
    } catch {
      this._status = 'offline'
    }

    if (this._status !== previous) {
      for (const listener of this.listeners) {
        try {
          listener(this._status)
        } catch {
          // Ignore listener errors
        }
      }
    }
  }
}
