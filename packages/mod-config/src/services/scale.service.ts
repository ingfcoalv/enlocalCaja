import type { Server as SocketServer } from 'socket.io'

export interface ScaleConfig {
  id: string
  name: string
  port: string         // "/dev/ttyUSB0" or "COM3"
  baudRate: number     // 9600 default
  protocol: 'generic' | 'torrey'
  isDefault?: boolean
}

export interface WeightReading {
  weight: number
  unit: string
  stable: boolean
}

/**
 * ScaleService — singleton that manages serial connection to a scale.
 *
 * SerialPort is loaded dynamically at runtime because it's a native module
 * that only exists in the Electron app, not in the shared package build.
 */
export class ScaleService {
  private serialPort: any = null
  private parser: any = null
  private currentWeight: number = 0
  private currentUnit: string = 'kg'
  private stable: boolean = false
  private io: SocketServer | null = null
  private connected: boolean = false

  getWeight(): WeightReading {
    return {
      weight: this.currentWeight,
      unit: this.currentUnit,
      stable: this.stable,
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  async connect(config: ScaleConfig, io: SocketServer): Promise<void> {
    // Disconnect existing connection first
    if (this.serialPort) {
      await this.disconnect()
    }

    this.io = io

    // Dynamically require serialport (native module in Electron)
    const { SerialPort } = await import('serialport')
    const { ReadlineParser } = await import('@serialport/parser-readline')

    this.serialPort = new SerialPort({
      path: config.port,
      baudRate: config.baudRate || 9600,
      autoOpen: false,
    })

    this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }))

    this.parser.on('data', (raw: string) => {
      const reading = this.parseWeight(raw, config.protocol)
      if (reading) {
        const changed =
          reading.weight !== this.currentWeight ||
          reading.unit !== this.currentUnit ||
          reading.stable !== this.stable

        this.currentWeight = reading.weight
        this.currentUnit = reading.unit
        this.stable = reading.stable

        if (changed && this.io) {
          this.io.emit('scale:weight', {
            weight: this.currentWeight,
            unit: this.currentUnit,
            stable: this.stable,
          })
        }
      }
    })

    this.serialPort.on('error', (err: Error) => {
      console.error('[ScaleService] Serial error:', err.message)
      if (this.io) {
        this.io.emit('scale:error', { message: err.message })
      }
    })

    this.serialPort.on('close', () => {
      this.connected = false
      if (this.io) {
        this.io.emit('scale:disconnected')
      }
    })

    return new Promise<void>((resolve, reject) => {
      this.serialPort.open((err: Error | null) => {
        if (err) {
          this.serialPort = null
          this.parser = null
          reject(err)
        } else {
          this.connected = true
          if (this.io) {
            this.io.emit('scale:connected')
          }
          resolve()
        }
      })
    })
  }

  async disconnect(): Promise<void> {
    if (this.serialPort && this.serialPort.isOpen) {
      return new Promise<void>((resolve) => {
        this.serialPort.close(() => {
          this.serialPort = null
          this.parser = null
          this.connected = false
          this.currentWeight = 0
          this.stable = false
          if (this.io) {
            this.io.emit('scale:disconnected')
          }
          resolve()
        })
      })
    }
    this.serialPort = null
    this.parser = null
    this.connected = false
  }

  /**
   * One-shot test: open port, read one weight, close.
   */
  async testRead(config: ScaleConfig): Promise<{ success: boolean; weight?: number; unit?: string; raw?: string; error?: string }> {
    const { SerialPort } = await import('serialport')
    const { ReadlineParser } = await import('@serialport/parser-readline')

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try { port.close() } catch {}
        resolve({ success: false, error: 'Timeout: no se recibio lectura en 5 segundos' })
      }, 5000)

      const port = new SerialPort({
        path: config.port,
        baudRate: config.baudRate || 9600,
        autoOpen: false,
      })

      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))

      parser.on('data', (raw: string) => {
        clearTimeout(timeout)
        const reading = this.parseWeight(raw, config.protocol)
        try { port.close() } catch {}
        if (reading) {
          resolve({ success: true, weight: reading.weight, unit: reading.unit, raw })
        } else {
          resolve({ success: false, error: 'No se pudo interpretar la lectura', raw })
        }
      })

      port.on('error', (err: Error) => {
        clearTimeout(timeout)
        resolve({ success: false, error: err.message })
      })

      port.open((err: Error | null) => {
        if (err) {
          clearTimeout(timeout)
          resolve({ success: false, error: err.message })
        }
      })
    })
  }

  parseWeight(raw: string, protocol: string): WeightReading | null {
    if (protocol === 'torrey') {
      return this.parseTorrey(raw)
    }
    return this.parseGeneric(raw)
  }

  /**
   * Generic protocol: "ST,GS,  1.250,kg" or "SD,US,  0.500,kg"
   * ST = Stable, SD = Still Dynamic
   * GS = Gross, US = Under-stable
   */
  private parseGeneric(raw: string): WeightReading | null {
    const match = raw.match(/(ST|SD),\s*(GS|US),\s*([+-]?\s*[\d.]+)\s*(\w+)/)
    if (!match) return null
    return {
      stable: match[1] === 'ST',
      weight: parseFloat(match[3].replace(/\s/g, '')),
      unit: match[4].toLowerCase(),
    }
  }

  /**
   * Torrey protocol: "  1.250 kg" or "-  0.500 lb"
   */
  private parseTorrey(raw: string): WeightReading | null {
    const match = raw.match(/([+-]?\s*[\d.]+)\s*(kg|lb|g)/i)
    if (!match) return null
    return {
      stable: true, // Torrey sends stable readings only
      weight: parseFloat(match[1].replace(/\s/g, '')),
      unit: match[2].toLowerCase(),
    }
  }

  /**
   * List available serial ports. Returns array of port info objects.
   */
  static async listPorts(): Promise<{ path: string; manufacturer?: string; serialNumber?: string }[]> {
    const { SerialPort } = await import('serialport')
    const ports = await SerialPort.list()
    return ports.map((p: any) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
    }))
  }
}
