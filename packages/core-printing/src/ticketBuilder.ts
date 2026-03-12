// TODO: Generador de tickets genérico
// - header, line, separator, total, footer, build()

export class TicketBuilder {
  header(_text: string): this { return this }
  line(_text: string): this { return this }
  separator(): this { return this }
  total(_label: string, _amount: string): this { return this }
  footer(_text: string): this { return this }
  build(): Buffer {
    // Implementación en Fase 11
    return Buffer.alloc(0)
  }
}
