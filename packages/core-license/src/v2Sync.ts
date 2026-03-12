/**
 * V2 license sync — fetches full license status from cloud.
 * Calls V1 validate first, then V2 full-status endpoint.
 * V2 data overwrites V1 data. Falls back to V1 if V2 fails.
 */

import { generateFingerprint } from './fingerprint'
import { readLicenseFile } from './storage'

export interface LicenseFullStatus {
  // From V1 validate
  status: string
  plan: string
  expiresAt: string
  modules: string[]
  addons: string[]
  signature: string

  // From V2 full-status (overwrites V1 when available)
  licenseState?: 'pending' | 'activated' | 'linked' | 'expired' | 'revoked'
  stamps?: {
    available: number
    totalPurchased: number
    totalUsed: number
  }
  business?: {
    id: string
    name: string
    rfc: string
  }
  branch?: {
    id: string
    name: string
  }
  features?: Record<string, boolean>
}

async function fetchV1Validate(cloudApiUrl: string, licenseFile: {
  installationHash?: string
  licenseKey: string
  terminalToken?: string
}, fingerprint: string, productCode?: string): Promise<LicenseFullStatus | null> {
  try {
    if (!licenseFile.terminalToken) return null

    const params = new URLSearchParams({
      terminal_token: licenseFile.terminalToken,
      hardware_fingerprint: fingerprint,
      product_code: productCode ?? 'enlocal_caja',
    })

    const response = await fetch(`${cloudApiUrl}/api/v1/licenses/validate?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) return null

    return (await response.json()) as LicenseFullStatus
  } catch {
    return null
  }
}

async function fetchV2FullStatus(cloudApiUrl: string, serial: string, fingerprint: string, terminalToken: string): Promise<Partial<LicenseFullStatus> | null> {
  try {
    const response = await fetch(
      `${cloudApiUrl}/api/v2/license-management/${serial}/full-status`,
      {
        method: 'GET',
        headers: {
          'X-Terminal-Token': terminalToken,
          'X-Hardware-Fingerprint': fingerprint,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) return null

    return (await response.json()) as Partial<LicenseFullStatus>
  } catch {
    return null
  }
}

/**
 * Fetch full license status: V1 validate + V2 full-status.
 * V2 overwrites V1 fields when available.
 * Falls back to V1-only if V2 fails.
 */
export async function fetchFullLicenseStatus(
  cloudApiUrl: string,
  serial: string,
  productCode?: string
): Promise<LicenseFullStatus | null> {
  const fingerprint = generateFingerprint()
  const licenseFile = readLicenseFile(fingerprint)

  if (!licenseFile) return null

  // Step 1: V1 validate
  const v1Result = await fetchV1Validate(cloudApiUrl, licenseFile, fingerprint, productCode)
  if (!v1Result) return null

  // Step 2: V2 full-status (overwrite V1)
  if (licenseFile.terminalToken) {
    const v2Result = await fetchV2FullStatus(
      cloudApiUrl,
      serial,
      fingerprint,
      licenseFile.terminalToken
    )

    if (v2Result) {
      return {
        ...v1Result,
        ...v2Result,
        // Preserve V1 fields that V2 doesn't override
        modules: v2Result.modules ?? v1Result.modules,
        addons: v2Result.addons ?? v1Result.addons,
      }
    }
  }

  // Fallback: V1 only
  return v1Result
}
