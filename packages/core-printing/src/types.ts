export interface PrinterConfig {
  ip: string
  port: number
  name: string
  paperWidth: 58 | 80
}

export interface PrintJob {
  id: string
  data: Buffer
  printer: PrinterConfig
  retries: number
  maxRetries: number
}
