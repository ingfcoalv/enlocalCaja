// ---------------------------------------------------------------------------
// Cloud Stamping Service — V2 API
// ---------------------------------------------------------------------------
// Uses terminal_token auth via buildCloudHeaders() from @enlocal/core-license.
// All endpoints point to /api/v2/invoicing/*.
// ---------------------------------------------------------------------------

import { buildCloudHeaders } from '@enlocal/core-license'

const CLOUD_API_URL =
  process.env.CLOUD_API_URL || 'https://api.todoenlocal.com'

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface StampRequest {
  type: string // I, E, P, T
  emisor: {
    rfc: string
    nombre: string
    regimenFiscal: string
    codigoPostal: string
  }
  receptor: {
    rfc: string
    nombre: string
    regimenFiscal: string
    usoCfdi: string
    codigoPostal: string
  }
  serie?: string
  folio?: number
  fecha: string
  formaPago?: string
  metodoPago?: string
  moneda: string
  tipoCambio?: number
  subtotal: string
  total: string
  tipoRelacion?: string
  cfdiRelacionados?: string[]
  conceptos: Array<{
    claveProdServ: string
    claveUnidad: string
    unidad?: string
    noIdentificacion?: string
    descripcion: string
    cantidad: string
    valorUnitario: string
    importe: string
    descuento?: string
    objetoImp: string
    impuestos?: {
      traslados?: Array<{
        base: string
        impuesto: string
        tipoFactor: string
        tasaOCuota: string
        importe: string
      }>
      retenciones?: Array<{
        base: string
        impuesto: string
        tipoFactor: string
        tasaOCuota: string
        importe: string
      }>
    }
  }>
  impuestos?: {
    totalImpuestosTrasladados?: string
    totalImpuestosRetenidos?: string
    traslados?: Array<{
      base: string
      impuesto: string
      tipoFactor: string
      tasaOCuota: string
      importe: string
    }>
    retenciones?: Array<{
      base: string
      impuesto: string
      tipoFactor: string
      tasaOCuota: string
      importe: string
    }>
  }
  complemento?: any // Pagos20 or CartaPorte data
  informacionGlobal?: { periodicidad: string; meses: string; anio: string }
}

export interface StampResponse {
  success: boolean
  uuid?: string
  xml?: string
  stampDate?: string
  cadenaOriginal?: string
  noCertificadoSAT?: string
  selloSAT?: string
  selloCFD?: string
  stamps_remaining?: number
  error?: string
}

export interface CancelRequest {
  uuid: string
  motivo: string // '01', '02', '03', '04'
  folioSustitucion?: string // UUID sustituto, only for motivo '01'
}

export interface CancelResponse {
  success: boolean
  status: 'cancelled' | 'cancel_pending' | 'error'
  acuse?: string
  cancelDate?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCloudHeaders(): Record<string, string> {
  try {
    return { ...buildCloudHeaders() }
  } catch {
    // Fallback if terminal token not available
    return {
      'Content-Type': 'application/json',
    }
  }
}

async function safeFetch(
  url: string,
  init: RequestInit
): Promise<Response | null> {
  try {
    return await fetch(url, init)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// stampCFDI — V2 endpoint
// ---------------------------------------------------------------------------

export async function stampCFDI(
  _cloudTenantId: string,
  request: StampRequest
): Promise<StampResponse> {
  const url = `${CLOUD_API_URL}/api/v2/invoicing/stamp`

  const response = await safeFetch(url, {
    method: 'POST',
    headers: getCloudHeaders(),
    body: JSON.stringify(request),
  })

  if (!response) {
    return { success: false, error: 'Cloud API unreachable' }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let errorMessage = `Cloud API error: ${response.status}`
    try {
      const parsed = JSON.parse(body)
      if (parsed.error) errorMessage = parsed.error
    } catch {
      if (body) errorMessage = body
    }
    return { success: false, error: errorMessage }
  }

  const data = (await response.json()) as StampResponse
  return data
}

// ---------------------------------------------------------------------------
// cancelCFDI — V2 endpoint
// ---------------------------------------------------------------------------

export async function cancelCFDI(
  _cloudTenantId: string,
  request: CancelRequest
): Promise<CancelResponse> {
  const url = `${CLOUD_API_URL}/api/v2/invoicing/cancel`

  const response = await safeFetch(url, {
    method: 'POST',
    headers: getCloudHeaders(),
    body: JSON.stringify(request),
  })

  if (!response) {
    return { success: false, status: 'error', error: 'Cloud API unreachable' }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let errorMessage = `Cloud API error: ${response.status}`
    try {
      const parsed = JSON.parse(body)
      if (parsed.error) errorMessage = parsed.error
    } catch {
      if (body) errorMessage = body
    }
    return { success: false, status: 'error', error: errorMessage }
  }

  const data = (await response.json()) as CancelResponse
  return data
}

// ---------------------------------------------------------------------------
// getCancelStatus — V2 endpoint
// ---------------------------------------------------------------------------

export async function getCancelStatus(
  _cloudTenantId: string,
  uuid: string
): Promise<{ status: string; cancellable: boolean }> {
  const url = `${CLOUD_API_URL}/api/v2/invoicing/cancel-status/${encodeURIComponent(uuid)}`

  const response = await safeFetch(url, {
    method: 'GET',
    headers: getCloudHeaders(),
  })

  if (!response) {
    return { status: 'unknown', cancellable: false }
  }

  if (!response.ok) {
    return { status: 'unknown', cancellable: false }
  }

  const data = (await response.json()) as { status: string; cancellable: boolean }
  return data
}

// ---------------------------------------------------------------------------
// uploadCertificates
// ---------------------------------------------------------------------------

export async function uploadCertificates(
  _cloudTenantId: string,
  cerBuffer: Buffer,
  keyBuffer: Buffer,
  password: string
): Promise<{
  success: boolean
  certificateNumber?: string
  validTo?: string
  error?: string
}> {
  const url = `${CLOUD_API_URL}/api/v2/invoicing/upload-cert`

  const form = new FormData()
  form.append('cer', new Blob([cerBuffer]), 'certificate.cer')
  form.append('key', new Blob([keyBuffer]), 'privatekey.key')
  form.append('password', password)

  // When using FormData the runtime sets Content-Type with the boundary
  // automatically, so we extract only auth headers.
  let headers: Record<string, string>
  try {
    const cloudHeaders = buildCloudHeaders()
    headers = {
      'X-Terminal-Token': cloudHeaders['X-Terminal-Token'],
      'X-Hardware-Fingerprint': cloudHeaders['X-Hardware-Fingerprint'],
    }
  } catch {
    headers = {}
  }

  let response: Response | null
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    response = null
  }

  if (!response) {
    return { success: false, error: 'Cloud API unreachable' }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let errorMessage = `Cloud API error: ${response.status}`
    try {
      const parsed = JSON.parse(body)
      if (parsed.error) errorMessage = parsed.error
    } catch {
      if (body) errorMessage = body
    }
    return { success: false, error: errorMessage }
  }

  const data = (await response.json()) as {
    success: boolean
    certificateNumber?: string
    validTo?: string
    error?: string
  }
  return data
}

// ---------------------------------------------------------------------------
// getCertStatus — V2 endpoint
// ---------------------------------------------------------------------------

export async function getCertStatus(
  _cloudTenantId: string
): Promise<{
  hasValidCert: boolean
  certificateNumber?: string
  validTo?: string
}> {
  const url = `${CLOUD_API_URL}/api/v2/invoicing/cert-status`

  const response = await safeFetch(url, {
    method: 'GET',
    headers: getCloudHeaders(),
  })

  if (!response) {
    return { hasValidCert: false }
  }

  if (!response.ok) {
    return { hasValidCert: false }
  }

  const data = (await response.json()) as {
    hasValidCert: boolean
    certificateNumber?: string
    validTo?: string
  }
  return data
}

// ---------------------------------------------------------------------------
// validateRFC — V2 endpoint (new)
// ---------------------------------------------------------------------------

export async function validateRFC(
  rfc: string
): Promise<{
  valid: boolean
  name?: string
  regimenFiscal?: string
  error?: string
}> {
  const url = `${CLOUD_API_URL}/api/v2/invoicing/validate-rfc`

  const response = await safeFetch(url, {
    method: 'POST',
    headers: getCloudHeaders(),
    body: JSON.stringify({ rfc }),
  })

  if (!response) {
    return { valid: false, error: 'Cloud API unreachable' }
  }

  if (!response.ok) {
    return { valid: false, error: `Validation failed: ${response.status}` }
  }

  return (await response.json()) as { valid: boolean; name?: string; regimenFiscal?: string }
}
