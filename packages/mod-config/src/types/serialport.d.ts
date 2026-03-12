// Ambient declarations for serialport — native module installed only in Electron app
declare module 'serialport' {
  export class SerialPort {
    constructor(options: { path: string; baudRate: number; autoOpen?: boolean })
    pipe<T>(parser: T): T
    open(callback: (err: Error | null) => void): void
    close(callback?: () => void): void
    write(data: Buffer | string, callback?: () => void): void
    on(event: string, listener: (...args: any[]) => void): this
    isOpen: boolean
    static list(): Promise<Array<{
      path: string
      manufacturer?: string
      serialNumber?: string
      pnpId?: string
      vendorId?: string
      productId?: string
    }>>
  }
}

declare module '@serialport/parser-readline' {
  export class ReadlineParser {
    constructor(options?: { delimiter?: string; encoding?: BufferEncoding })
    on(event: 'data', listener: (data: string) => void): this
    on(event: string, listener: (...args: any[]) => void): this
  }
}
