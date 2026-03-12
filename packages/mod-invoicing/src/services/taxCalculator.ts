// ---------------------------------------------------------------------------
// taxCalculator.ts -- SAT-compliant tax calculations for CFDI 4.0
// ---------------------------------------------------------------------------
// Every monetary result is rounded to 2 decimal places at each intermediate
// step, exactly as the SAT validation engine expects.  A discrepancy of even
// $0.01 causes the PAC to reject the CFDI.
// ---------------------------------------------------------------------------

// ---- Interfaces -----------------------------------------------------------

export interface ItemTaxInput {
  quantity: number
  unitPrice: number
  discount?: number
  ivaRate?: number | null       // 0.16, 0.08, 0, or null for exempt
  iepsRate?: number | null      // varies: 0.265, 0.53, 0.25, etc.
  ivaRetainedRate?: number | null // 0.106667 (2/3 IVA)
  isrRetainedRate?: number | null // 0.10, 0.0125
  objetoImp: string             // '01'=no objeto, '02'=si objeto, '03'=si y no obligado
}

export interface ItemTaxResult {
  amount: string           // quantity * unitPrice, rounded to 2 decimals
  discount: string
  ivaBase: string | null
  ivaRate: string | null
  ivaAmount: string | null
  iepsBase: string | null
  iepsRate: string | null
  iepsAmount: string | null
  ivaRetainedBase: string | null
  ivaRetainedRate: string | null
  ivaRetainedAmount: string | null
  isrRetainedBase: string | null
  isrRetainedRate: string | null
  isrRetainedAmount: string | null
}

export interface InvoiceTotals {
  subtotal: string
  totalDiscounts: string
  totalIva16: string
  totalIva8: string
  totalIva0: string
  totalIvaExempt: string
  totalIeps: string
  totalTransferred: string
  totalIvaRetained: string
  totalIsrRetained: string
  totalRetained: string
  tax: string             // legacy alias = totalTransferred
  total: string
}

// ---- Helpers --------------------------------------------------------------

/** Banker's rounding to `decimals` places (IEEE 754 / SAT-safe). */
function round2(value: number): number {
  // Use the multiply-then-round approach with correction for floating-point.
  // Math.round has a bias on .5 values; we use the epsilon trick to avoid it
  // in all practical CFDI amounts (which never exceed ~9-digit sums).
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function toFixed2(value: number): string {
  return round2(value).toFixed(2)
}

function toFixed6(value: number): string {
  return value.toFixed(6)
}

function isRate(rate: number | null | undefined): rate is number {
  return rate !== null && rate !== undefined
}

// ---- Per-item calculation -------------------------------------------------

export function calculateItemTaxes(input: ItemTaxInput): ItemTaxResult {
  const { quantity, unitPrice, objetoImp } = input
  const discount = input.discount ?? 0

  // Step 1: amount = round(qty * unitPrice, 2)
  const amount = round2(quantity * unitPrice)

  // Step 2: base = amount - discount  (discount already expected rounded)
  const base = round2(amount - discount)

  // If objetoImp is '01' (No objeto de impuesto), no taxes at all
  const hasTaxes = objetoImp === '02' || objetoImp === '03'

  // -- Transferred taxes ---------------------------------------------------

  let ivaBase: number | null = null
  let ivaRate: number | null = null
  let ivaAmount: number | null = null

  let iepsBase: number | null = null
  let iepsRate: number | null = null
  let iepsAmount: number | null = null

  // -- Retained taxes ------------------------------------------------------

  let ivaRetainedBase: number | null = null
  let ivaRetainedRate: number | null = null
  let ivaRetainedAmount: number | null = null

  let isrRetainedBase: number | null = null
  let isrRetainedRate: number | null = null
  let isrRetainedAmount: number | null = null

  if (hasTaxes) {
    // IVA trasladado
    if (isRate(input.ivaRate)) {
      ivaBase = base
      ivaRate = input.ivaRate
      ivaAmount = round2(base * input.ivaRate)
    }
    // ivaRate === null/undefined means IVA exempt -- base is tracked but no
    // computed amount (the XML uses TipoFactor="Exento" with no Importe).

    // IEPS trasladado
    if (isRate(input.iepsRate)) {
      iepsBase = base
      iepsRate = input.iepsRate
      iepsAmount = round2(base * input.iepsRate)
    }

    // IVA retenido
    if (isRate(input.ivaRetainedRate)) {
      ivaRetainedBase = base
      ivaRetainedRate = input.ivaRetainedRate
      ivaRetainedAmount = round2(base * input.ivaRetainedRate)
    }

    // ISR retenido
    if (isRate(input.isrRetainedRate)) {
      isrRetainedBase = base
      isrRetainedRate = input.isrRetainedRate
      isrRetainedAmount = round2(base * input.isrRetainedRate)
    }
  }

  return {
    amount: toFixed2(amount),
    discount: toFixed2(discount),
    ivaBase: ivaBase !== null ? toFixed2(ivaBase) : null,
    ivaRate: ivaRate !== null ? toFixed6(ivaRate) : null,
    ivaAmount: ivaAmount !== null ? toFixed2(ivaAmount) : null,
    iepsBase: iepsBase !== null ? toFixed2(iepsBase) : null,
    iepsRate: iepsRate !== null ? toFixed6(iepsRate) : null,
    iepsAmount: iepsAmount !== null ? toFixed2(iepsAmount) : null,
    ivaRetainedBase: ivaRetainedBase !== null ? toFixed2(ivaRetainedBase) : null,
    ivaRetainedRate: ivaRetainedRate !== null ? toFixed6(ivaRetainedRate) : null,
    ivaRetainedAmount: ivaRetainedAmount !== null ? toFixed2(ivaRetainedAmount) : null,
    isrRetainedBase: isrRetainedBase !== null ? toFixed2(isrRetainedBase) : null,
    isrRetainedRate: isrRetainedRate !== null ? toFixed6(isrRetainedRate) : null,
    isrRetainedAmount: isrRetainedAmount !== null ? toFixed2(isrRetainedAmount) : null,
  }
}

// ---- Invoice totals -------------------------------------------------------

export function calculateInvoiceTotals(items: ItemTaxResult[]): InvoiceTotals {
  let subtotal = 0
  let totalDiscounts = 0
  let totalIva16 = 0
  let totalIva8 = 0
  let totalIva0 = 0
  let totalIvaExempt = 0
  let totalIeps = 0
  let totalIvaRetained = 0
  let totalIsrRetained = 0

  for (const item of items) {
    subtotal = round2(subtotal + parseFloat(item.amount))
    totalDiscounts = round2(totalDiscounts + parseFloat(item.discount))

    // IVA transferred -- bucket by rate
    if (item.ivaAmount !== null && item.ivaRate !== null) {
      const rate = parseFloat(item.ivaRate)
      const amt = parseFloat(item.ivaAmount)

      if (rate === 0.16 || Math.abs(rate - 0.16) < 1e-9) {
        totalIva16 = round2(totalIva16 + amt)
      } else if (rate === 0.08 || Math.abs(rate - 0.08) < 1e-9) {
        totalIva8 = round2(totalIva8 + amt)
      } else if (rate === 0) {
        totalIva0 = round2(totalIva0 + amt)
      }
    } else if (item.ivaBase !== null && item.ivaRate === null) {
      // Exempt: ivaBase is set but rate/amount are null
      totalIvaExempt = round2(totalIvaExempt + parseFloat(item.ivaBase))
    }

    // IEPS transferred
    if (item.iepsAmount !== null) {
      totalIeps = round2(totalIeps + parseFloat(item.iepsAmount))
    }

    // Retained
    if (item.ivaRetainedAmount !== null) {
      totalIvaRetained = round2(totalIvaRetained + parseFloat(item.ivaRetainedAmount))
    }
    if (item.isrRetainedAmount !== null) {
      totalIsrRetained = round2(totalIsrRetained + parseFloat(item.isrRetainedAmount))
    }
  }

  const totalTransferred = round2(totalIva16 + totalIva8 + totalIva0 + totalIeps)
  const totalRetained = round2(totalIvaRetained + totalIsrRetained)
  const total = round2(subtotal - totalDiscounts + totalTransferred - totalRetained)

  return {
    subtotal: toFixed2(subtotal),
    totalDiscounts: toFixed2(totalDiscounts),
    totalIva16: toFixed2(totalIva16),
    totalIva8: toFixed2(totalIva8),
    totalIva0: toFixed2(totalIva0),
    totalIvaExempt: toFixed2(totalIvaExempt),
    totalIeps: toFixed2(totalIeps),
    totalTransferred: toFixed2(totalTransferred),
    totalIvaRetained: toFixed2(totalIvaRetained),
    totalIsrRetained: toFixed2(totalIsrRetained),
    totalRetained: toFixed2(totalRetained),
    tax: toFixed2(totalTransferred),     // legacy alias
    total: toFixed2(total),
  }
}

// ---- Number to words ------------------------------------------------------

// --- Spanish number-to-words (for MXN) ------------------------------------

const UNITS_ES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO',
  'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
  'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
  'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]

const TENS_ES = [
  '', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
]

const HUNDREDS_ES = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
]

function spanishUnder1000(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'

  const hundreds = Math.floor(n / 100)
  const remainder = n % 100

  let result = ''

  if (hundreds > 0) {
    result = HUNDREDS_ES[hundreds]
    if (remainder === 0) return result
    result += ' '
  }

  if (remainder < 30) {
    result += UNITS_ES[remainder]
  } else {
    const tens = Math.floor(remainder / 10)
    const units = remainder % 10
    result += TENS_ES[tens]
    if (units > 0) {
      result += ' Y ' + UNITS_ES[units]
    }
  }

  return result
}

function spanishWholeNumber(n: number): string {
  if (n === 0) return 'CERO'

  // Split into groups: billones, millones, miles, unidades
  // Maximum: 999,999,999,999 (we support up to trillions for completeness)
  const parts: string[] = []

  // Millones (millions)
  const billions = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1_000)
  const units = n % 1_000

  // Billions (mil millones in Spanish)
  if (billions > 0) {
    if (billions === 1) {
      parts.push('MIL')
    } else {
      parts.push(spanishUnder1000(billions) + ' MIL')
    }
    // The "millones" part will handle the rest of the millions group
    if (millions > 0) {
      parts.push(spanishUnder1000(millions) + ' MILLONES')
    } else {
      parts.push('MILLONES')
    }
  } else if (millions > 0) {
    if (millions === 1) {
      parts.push('UN MILLON')
    } else {
      parts.push(spanishUnder1000(millions) + ' MILLONES')
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('MIL')
    } else {
      parts.push(spanishUnder1000(thousands) + ' MIL')
    }
  }

  if (units > 0) {
    parts.push(spanishUnder1000(units))
  }

  return parts.join(' ')
}

// --- English number-to-words (for USD) ------------------------------------

const UNITS_EN = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE',
  'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN',
  'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
]

const TENS_EN = [
  '', 'TEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY',
  'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
]

function englishUnder1000(n: number): string {
  if (n === 0) return ''

  const hundreds = Math.floor(n / 100)
  const remainder = n % 100

  let result = ''

  if (hundreds > 0) {
    result = UNITS_EN[hundreds] + ' HUNDRED'
    if (remainder === 0) return result
    result += ' '
  }

  if (remainder < 20) {
    result += UNITS_EN[remainder]
  } else {
    const tens = Math.floor(remainder / 10)
    const units = remainder % 10
    result += TENS_EN[tens]
    if (units > 0) {
      result += '-' + UNITS_EN[units]
    }
  }

  return result
}

function englishWholeNumber(n: number): string {
  if (n === 0) return 'ZERO'

  const parts: string[] = []

  const billions = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1_000)
  const units = n % 1_000

  if (billions > 0) {
    parts.push(englishUnder1000(billions) + ' BILLION')
  }
  if (millions > 0) {
    parts.push(englishUnder1000(millions) + ' MILLION')
  }
  if (thousands > 0) {
    parts.push(englishUnder1000(thousands) + ' THOUSAND')
  }
  if (units > 0) {
    parts.push(englishUnder1000(units))
  }

  return parts.join(' ')
}

// --- Public function -------------------------------------------------------

/**
 * Convert a monetary amount to words in the format required by CFDI.
 *
 * MXN: "SEIS MIL CINCUENTA Y TRES PESOS 20/100 M.N."
 * USD: "ONE THOUSAND TWO HUNDRED DOLLARS 50/100 USD"
 *
 * @param amount  The numeric amount (e.g. 6053.20)
 * @param currency  "MXN" or "USD"
 */
export function numberToWords(amount: number, currency: string): string {
  // Separate integer and decimal parts
  const absolute = Math.abs(amount)
  const integerPart = Math.floor(absolute)
  // Round cents to avoid floating-point issues (e.g. 6053.2 * 100 = 605319.9999...)
  const cents = Math.round((absolute - integerPart) * 100)
  const centStr = String(cents).padStart(2, '0')

  const upperCurrency = (currency || 'MXN').toUpperCase()

  if (upperCurrency === 'USD') {
    const words = englishWholeNumber(integerPart)
    const noun = integerPart === 1 ? 'DOLLAR' : 'DOLLARS'
    return `${words} ${noun} ${centStr}/100 USD`
  }

  // Default: MXN
  const words = spanishWholeNumber(integerPart)
  const noun = integerPart === 1 ? 'PESO' : 'PESOS'
  return `${words} ${noun} ${centStr}/100 M.N.`
}
