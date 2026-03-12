import { generateFingerprint } from './fingerprint'
import { readLicenseFile } from './storage'

export interface CloudHeaders {
  'X-Terminal-Token': string
  'X-Hardware-Fingerprint': string
  'X-Product-Code'?: string
  'Content-Type': string
}

export interface SessionHeaders extends CloudHeaders {
  Authorization: string
}

/**
 * Build headers for cloud API calls using terminal_token auth.
 * Used by sync, invoicing, and any cloud-facing request.
 */
export function buildCloudHeaders(productCode?: string): CloudHeaders {
  const fingerprint = generateFingerprint()
  const licenseFile = readLicenseFile(fingerprint)

  if (!licenseFile?.terminalToken) {
    throw new Error('No terminal token available. License must be activated first.')
  }

  const headers: CloudHeaders = {
    'X-Terminal-Token': licenseFile.terminalToken,
    'X-Hardware-Fingerprint': fingerprint,
    'Content-Type': 'application/json',
  }

  if (productCode) {
    headers['X-Product-Code'] = productCode
  }

  return headers
}

/**
 * Build headers for session-authenticated API calls.
 * Extends cloud headers with Bearer session token.
 */
export function buildSessionHeaders(sessionToken: string, productCode?: string): SessionHeaders {
  const cloudHeaders = buildCloudHeaders(productCode)

  return {
    ...cloudHeaders,
    Authorization: `Bearer ${sessionToken}`,
  }
}

/**
 * Get terminal token from license file without building full headers.
 */
export function getTerminalToken(): string | null {
  const fingerprint = generateFingerprint()
  const licenseFile = readLicenseFile(fingerprint)
  return licenseFile?.terminalToken ?? null
}
