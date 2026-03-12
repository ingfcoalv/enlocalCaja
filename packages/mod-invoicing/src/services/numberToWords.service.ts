// ---------------------------------------------------------------------------
// numberToWords.service.ts — Convert monetary amounts to text (SAT CFDI)
// ---------------------------------------------------------------------------
// Converts a numeric amount to its text representation in UPPERCASE,
// in the format required by the SAT for the CFDI printed representation.
//
// MXN: "{TEXTO} PESOS {centavos}/100 M.N."
// USD: "{TEXT} DOLLARS {cents}/100 USD"
// EUR: "{TEXT} EUROS {cents}/100 EUR"
// ---------------------------------------------------------------------------

// ── Spanish tables ──────────────────────────────────────────────

const UNITS_ES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO',
  'SEIS', 'SIETE', 'OCHO', 'NUEVE',
]

const TEENS_ES = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
]

const TWENTIES_ES = [
  'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
  'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]

const TENS_ES = [
  '', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
]

const HUNDREDS_ES = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
]

// ── English tables ──────────────────────────────────────────────

const UNITS_EN = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE',
  'SIX', 'SEVEN', 'EIGHT', 'NINE',
]

const TEENS_EN = [
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN',
  'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
]

const TENS_EN = [
  '', 'TEN', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY',
  'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
]

// ── Currency names ──────────────────────────────────────────────

const CURRENCY_NAMES: Record<string, { singular: string; plural: string; suffix: string; lang: 'es' | 'en' }> = {
  MXN: { singular: 'PESO', plural: 'PESOS', suffix: 'M.N.', lang: 'es' },
  USD: { singular: 'DOLLAR', plural: 'DOLLARS', suffix: 'USD', lang: 'en' },
  EUR: { singular: 'EURO', plural: 'EUROS', suffix: 'EUR', lang: 'en' },
  GBP: { singular: 'POUND', plural: 'POUNDS', suffix: 'GBP', lang: 'en' },
  CAD: { singular: 'DOLLAR', plural: 'DOLLARS', suffix: 'CAD', lang: 'en' },
  JPY: { singular: 'YEN', plural: 'YEN', suffix: 'JPY', lang: 'en' },
  CHF: { singular: 'FRANC', plural: 'FRANCS', suffix: 'CHF', lang: 'en' },
  CNY: { singular: 'YUAN', plural: 'YUAN', suffix: 'CNY', lang: 'en' },
  BRL: { singular: 'REAL', plural: 'REAIS', suffix: 'BRL', lang: 'en' },
}

// ── Spanish conversion ──────────────────────────────────────────

/**
 * Convert a number 0-999 to Spanish text.
 */
function convertGroupES(n: number): string {
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

  if (remainder < 10) {
    result += UNITS_ES[remainder]
  } else if (remainder < 20) {
    result += TEENS_ES[remainder - 10]
  } else if (remainder < 30) {
    result += TWENTIES_ES[remainder - 20]
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

/**
 * Convert an integer to Spanish text.
 * Handles up to 999,999,999,999 (mil millones).
 *
 * Rules:
 * - 0 → "CERO"
 * - 1 → "UN" (not "UNO")
 * - 21 → "VEINTIÚN"
 * - 100 → "CIEN" (not "CIENTO")
 * - 1000 → "MIL" (not "UN MIL")
 * - 1000000 → "UN MILLÓN"
 * - 2000000 → "DOS MILLONES"
 * - 1000000000 → "MIL MILLONES"
 */
function convertSpanish(n: number): string {
  if (n === 0) return 'CERO'

  const parts: string[] = []

  // Mil millones (billions in short scale = 1,000,000,000)
  const billionGroup = Math.floor(n / 1_000_000_000)
  const millionGroup = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousandGroup = Math.floor((n % 1_000_000) / 1_000)
  const unitGroup = n % 1_000

  // Billions → expressed as "X MIL MILLONES" in Spanish
  if (billionGroup > 0) {
    if (billionGroup === 1) {
      parts.push('MIL')
    } else {
      parts.push(convertGroupES(billionGroup) + ' MIL')
    }
    // We need to handle the millions part together
    if (millionGroup > 0) {
      parts.push(convertGroupES(millionGroup) + ' MILLONES')
    } else {
      parts.push('MILLONES')
    }
  } else if (millionGroup > 0) {
    if (millionGroup === 1) {
      parts.push('UN MILLÓN')
    } else {
      parts.push(convertGroupES(millionGroup) + ' MILLONES')
    }
  }

  // Thousands
  if (thousandGroup > 0) {
    if (thousandGroup === 1) {
      parts.push('MIL')
    } else {
      parts.push(convertGroupES(thousandGroup) + ' MIL')
    }
  }

  // Units
  if (unitGroup > 0) {
    parts.push(convertGroupES(unitGroup))
  }

  return parts.join(' ')
}

// ── English conversion ──────────────────────────────────────────

/**
 * Convert a number 0-999 to English text.
 */
function convertGroupEN(n: number): string {
  if (n === 0) return ''

  const hundreds = Math.floor(n / 100)
  const remainder = n % 100
  let result = ''

  if (hundreds > 0) {
    result = UNITS_EN[hundreds] + ' HUNDRED'
    if (remainder === 0) return result
    result += ' '
  }

  if (remainder < 10) {
    result += UNITS_EN[remainder]
  } else if (remainder < 20) {
    result += TEENS_EN[remainder - 10]
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

/**
 * Convert an integer to English text.
 * Handles up to 999,999,999,999.
 */
function convertEnglish(n: number): string {
  if (n === 0) return 'ZERO'

  const parts: string[] = []

  const billions = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1_000)
  const units = n % 1_000

  if (billions > 0) parts.push(convertGroupEN(billions) + ' BILLION')
  if (millions > 0) parts.push(convertGroupEN(millions) + ' MILLION')
  if (thousands > 0) parts.push(convertGroupEN(thousands) + ' THOUSAND')
  if (units > 0) parts.push(convertGroupEN(units))

  return parts.join(' ')
}

// ── Public function ─────────────────────────────────────────────

/**
 * Convert a monetary amount to words in the format required by CFDI.
 *
 * MXN: "SEIS MIL CINCUENTA Y TRES PESOS 20/100 M.N."
 * USD: "ONE THOUSAND TWO HUNDRED DOLLARS 50/100 USD"
 *
 * Important: "UN MILLÓN DE PESOS" uses "DE" when the million stands alone.
 *            "UN MILLÓN QUINIENTOS MIL PESOS" does NOT use "DE".
 */
export function numberToWords(amount: number, currency: string = 'MXN'): string {
  const absolute = Math.abs(amount)
  const integerPart = Math.floor(absolute)
  const cents = Math.round((absolute - integerPart) * 100)
  const centStr = String(cents).padStart(2, '0')

  const upperCurrency = (currency || 'MXN').toUpperCase()
  const currencyInfo = CURRENCY_NAMES[upperCurrency] || { singular: upperCurrency, plural: upperCurrency, suffix: upperCurrency, lang: 'en' }

  const isSpanish = currencyInfo.lang === 'es'
  const words = isSpanish ? convertSpanish(integerPart) : convertEnglish(integerPart)
  const noun = integerPart === 1 ? currencyInfo.singular : currencyInfo.plural

  // Spanish "DE" rule: "UN MILLÓN DE PESOS" but "UN MILLÓN QUINIENTOS MIL PESOS"
  // The "DE" is added when the amount is an exact multiple of a million (no remainder)
  if (isSpanish && integerPart >= 1_000_000 && integerPart % 1_000_000 === 0) {
    return `${words} DE ${noun} ${centStr}/100 ${currencyInfo.suffix}`
  }

  return `${words} ${noun} ${centStr}/100 ${currencyInfo.suffix}`
}
