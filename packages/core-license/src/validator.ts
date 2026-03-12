import type { ValidationResult, ActivationResult, SessionResult, CloudActivationResponse, CloudValidationResponse, CloudTrialResponse, CloudTrialErrorResponse, TrialStatus } from './types'
import { generateFingerprint, getHardwareDetails } from './fingerprint'
import { readLicenseFile, saveLicenseFile, deleteLicenseFile } from './storage'

function getDaysRemaining(expiresAt: string): number {
  const expiry = new Date(expiresAt)
  const now = new Date()
  const diff = expiry.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ─── Addon name mapping: cloud → local module names ─────────
const ADDON_TO_MODULE: Record<string, string> = {
  facturacion: 'mod-invoicing',
  reportes_avanzados: 'mod-reports',
  inventario: 'mod-inventory',
  punto_venta: 'mod-pos',
  cotizaciones: 'mod-quotes',
  remisiones: 'mod-remissions',
  cuentas_por_pagar: 'mod-payables',
  nominas: 'mod-payroll',
  citas: 'mod-appointments',
  multicaja: 'mod-multicaja',
}

function mapCloudAddons(cloudAddons: string[]): string[] {
  return cloudAddons.map(a => {
    if (a.startsWith('mod-')) return a
    return ADDON_TO_MODULE[a] ?? a
  })
}

// ─── TRIAL: Register Trial in Cloud ─────────────────────────
// POST /api/v1/pos/desktop/trial
export async function registerTrial(config: {
  cloudApiUrl: string
  appId: string
  productCode?: string
  version?: string
}): Promise<{ success: boolean; message: string; trialEndsAt?: string; terminalToken?: string }> {
  const fingerprint = generateFingerprint()
  const hardware = getHardwareDetails()

  const response = await fetch(`${config.cloudApiUrl}/api/v1/pos/desktop/trial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hardware_fingerprint: fingerprint,
      hardware_details: {
        hostname: hardware.hostname,
        os_version: hardware.platform,
        cpu_id: hardware.cpuModel,
        mac_address: hardware.macAddress,
        disk_serial: hardware.diskSerial,
      },
      product_code: config.productCode ?? config.appId,
      pos_version: config.version ?? '1.0.0',
    }),
  })

  if (response.status === 409) {
    // Trial already expired for this hardware
    const errorBody = (await response.json()) as CloudTrialErrorResponse
    // Mark license file as trial_expired
    const existing = readLicenseFile(fingerprint)
    saveLicenseFile(
      {
        fingerprint,
        licenseKey: '',
        appId: config.appId,
        plan: 'trial',
        expiresAt: errorBody.trial?.ends_at ?? '',
        modules: [],
        addons: [],
        businessId: '',
        branchId: '',
        terminalId: '',
        lastCloudValidation: new Date().toISOString(),
        licenseState: 'trial_expired',
        trialStartedAt: errorBody.trial?.started_at ?? existing?.trialStartedAt,
        trialEndsAt: errorBody.trial?.ends_at ?? existing?.trialEndsAt,
        trialRegistered: true,
        maxTerminals: 1,
      },
      fingerprint
    )
    return { success: false, message: errorBody.message || 'El periodo de prueba ya fue utilizado en este equipo.' }
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Trial registration failed (HTTP ${response.status}): ${text}`)
  }

  const cloud = (await response.json()) as CloudTrialResponse

  saveLicenseFile(
    {
      fingerprint,
      licenseKey: '',
      appId: config.appId,
      plan: 'trial',
      expiresAt: cloud.trial.ends_at,
      modules: [],
      addons: [],
      businessId: '',
      branchId: '',
      terminalId: '',
      lastCloudValidation: new Date().toISOString(),
      terminalToken: cloud.terminal_token,
      licenseState: 'trial',
      trialStartedAt: cloud.trial.started_at,
      trialEndsAt: cloud.trial.ends_at,
      trialRegistered: true,
      maxTerminals: 1,
    },
    fingerprint
  )

  return {
    success: true,
    message: cloud.message,
    trialEndsAt: cloud.trial.ends_at,
    terminalToken: cloud.terminal_token,
  }
}

// ─── TRIAL: Start Offline Trial (no internet) ──────────────
export function startOfflineTrial(config: {
  appId: string
}): { success: boolean; trialEndsAt: string } {
  const fingerprint = generateFingerprint()
  const existing = readLicenseFile(fingerprint)

  // If trial_expired, don't allow a new offline trial
  if (existing?.licenseState === 'trial_expired') {
    return { success: false, trialEndsAt: existing.trialEndsAt ?? '' }
  }

  // If already has an offline trial, return existing
  if (existing?.licenseState === 'trial' && existing.offlineTrialStartedAt) {
    return { success: true, trialEndsAt: existing.trialEndsAt ?? '' }
  }

  const now = new Date()
  const endsAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)

  saveLicenseFile(
    {
      fingerprint,
      licenseKey: '',
      appId: config.appId,
      plan: 'trial',
      expiresAt: endsAt.toISOString(),
      modules: [],
      addons: [],
      businessId: '',
      branchId: '',
      terminalId: '',
      lastCloudValidation: now.toISOString(),
      licenseState: 'trial',
      trialStartedAt: now.toISOString(),
      trialEndsAt: endsAt.toISOString(),
      trialRegistered: false,
      offlineTrialStartedAt: now.toISOString(),
      maxTerminals: 1,
    },
    fingerprint
  )

  return { success: true, trialEndsAt: endsAt.toISOString() }
}

// ─── TRIAL: Get Trial Status ────────────────────────────────
export function getTrialStatus(): TrialStatus {
  const fingerprint = generateFingerprint()
  const lf = readLicenseFile(fingerprint)

  if (!lf || (lf.licenseState !== 'trial' && lf.licenseState !== 'trial_expired')) {
    return { isTrial: false, isRegistered: false, trialEndsAt: null, daysRemaining: 0, offlineGraceExpired: false, isExpired: false }
  }

  const daysRemaining = lf.trialEndsAt ? getDaysRemaining(lf.trialEndsAt) : 0
  const isExpired = lf.licenseState === 'trial_expired' || daysRemaining <= 0

  // Check offline grace: 3 days without registration
  let offlineGraceExpired = false
  if (!lf.trialRegistered && lf.offlineTrialStartedAt) {
    const daysSinceOfflineStart = getDaysSince(lf.offlineTrialStartedAt)
    offlineGraceExpired = daysSinceOfflineStart > 3
  }

  return {
    isTrial: true,
    isRegistered: lf.trialRegistered ?? false,
    trialEndsAt: lf.trialEndsAt ?? null,
    daysRemaining: Math.max(0, daysRemaining),
    offlineGraceExpired,
    isExpired,
  }
}

// ─── STAGE 1: Activate License ─────────────────────────────
// POST /api/v1/licenses/activate
export async function activateLicense(config: {
  cloudApiUrl: string
  appId: string
  serialKey: string
  productCode?: string
  version?: string
}): Promise<ActivationResult> {
  const fingerprint = generateFingerprint()
  const hardware = getHardwareDetails()

  const response = await fetch(`${config.cloudApiUrl}/api/v1/licenses/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serial_number: config.serialKey,
      hardware_fingerprint: fingerprint,
      hardware_details: {
        hostname: hardware.hostname,
        os_version: hardware.platform,
        cpu_id: hardware.cpuModel,
        mac_address: hardware.macAddress,
        disk_serial: hardware.diskSerial,
      },
      pos_version: config.version ?? '1.0.0',
      product_code: config.productCode ?? config.appId,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = ''
    try {
      const err = JSON.parse(text) as { message?: string; detail?: string }
      detail = err.message || err.detail || text
    } catch {
      detail = text
    }
    throw new Error(`Activation failed (HTTP ${response.status}): ${detail}`)
  }

  const cloud = (await response.json()) as CloudActivationResponse

  // Activation response doesn't include addons — those come from validation
  const plan = cloud.license.pos_type ?? 'retail'
  const expiresAt = cloud.license.valid_until ?? ''

  // Save license file with terminal_token
  saveLicenseFile(
    {
      fingerprint,
      licenseKey: config.serialKey,
      appId: config.appId,
      plan,
      expiresAt,
      modules: [],
      addons: [],
      businessId: cloud.license.business_id ?? '',
      branchId: cloud.license.branch_id ?? '',
      terminalId: cloud.license.terminal_id ?? '',
      lastCloudValidation: new Date().toISOString(),
      terminalToken: cloud.terminal_token,
      licenseState: 'activated',
    },
    fingerprint
  )

  return {
    message: cloud.message,
    terminalToken: cloud.terminal_token,
    plan,
    expiresAt,
    modules: [],
    addons: [],
    businessId: cloud.license.business_id ?? '',
    branchId: cloud.license.branch_id ?? '',
    terminalId: cloud.license.terminal_id ?? '',
  }
}

// ─── STAGE 2: Validate License ─────────────────────────────
// POST /api/v1/licenses/validate?terminal_token=...&hardware_fingerprint=...&product_code=...
export async function validateLicense(config: {
  cloudApiUrl: string
  appId: string
  productCode?: string
}): Promise<ValidationResult> {
  const fingerprint = generateFingerprint()
  const licenseFile = readLicenseFile(fingerprint)

  if (!licenseFile) {
    return {
      valid: false,
      plan: '',
      expiresAt: '',
      modules: [],
      addons: [],
      daysRemaining: 0,
      showExpiryAlert: false,
      reason: 'NO_LICENSE_FILE',
    }
  }

  // ─── Trial: unregistered offline grace check ───
  if (licenseFile.licenseState === 'trial' && !licenseFile.trialRegistered && licenseFile.offlineTrialStartedAt) {
    const daysSinceOfflineStart = getDaysSince(licenseFile.offlineTrialStartedAt)
    if (daysSinceOfflineStart > 3) {
      return {
        valid: false,
        plan: 'trial',
        expiresAt: licenseFile.trialEndsAt ?? '',
        modules: [],
        addons: [],
        daysRemaining: 0,
        showExpiryAlert: false,
        reason: 'TRIAL_OFFLINE_GRACE_EXPIRED',
        licenseState: 'trial',
        maxTerminals: 1,
      }
    }
  }

  // ─── Trial expired (already marked) ───
  if (licenseFile.licenseState === 'trial_expired') {
    return {
      valid: false,
      plan: 'trial',
      expiresAt: licenseFile.trialEndsAt ?? '',
      modules: [],
      addons: [],
      daysRemaining: 0,
      showExpiryAlert: false,
      reason: 'TRIAL_EXPIRED',
      licenseState: 'trial_expired',
      maxTerminals: 1,
    }
  }

  if (licenseFile.fingerprint !== fingerprint) {
    return {
      valid: false,
      plan: '',
      expiresAt: '',
      modules: [],
      addons: [],
      daysRemaining: 0,
      showExpiryAlert: false,
      reason: 'HARDWARE_MISMATCH',
    }
  }

  // Try online validation
  try {
    if (!licenseFile.terminalToken) {
      throw new Error('No terminal token')
    }

    const params = new URLSearchParams({
      terminal_token: licenseFile.terminalToken,
      hardware_fingerprint: fingerprint,
      product_code: config.productCode ?? config.appId,
    })

    console.log('[validator] Calling cloud validate...')
    const response = await fetch(`${config.cloudApiUrl}/api/v1/licenses/validate?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    console.log(`[validator] Cloud response: HTTP ${response.status} ok=${response.ok}`)

    if (response.ok) {
      const cloud = (await response.json()) as CloudValidationResponse

      const licenseStatus = cloud.license?.status
      const mappedAddons = mapCloudAddons(cloud.addons ?? [])
      const plan = cloud.license?.pos_type ?? licenseFile.plan ?? 'retail'
      const expiresAt = cloud.license?.valid_until ?? licenseFile.expiresAt ?? ''

      // Handle revoked/expired states
      if (licenseStatus === 'revoked') {
        deleteLicenseFile()
        return {
          valid: false,
          plan,
          expiresAt,
          modules: [],
          addons: [],
          daysRemaining: 0,
          showExpiryAlert: false,
          reason: 'LICENSE_REVOKED',
          licenseState: 'revoked',
        }
      }

      if (licenseStatus === 'expired') {
        saveLicenseFile(
          {
            ...licenseFile,
            plan,
            expiresAt,
            licenseState: 'expired',
            lastCloudValidation: new Date().toISOString(),
          },
          fingerprint
        )
        return {
          valid: false,
          plan,
          expiresAt,
          modules: [],
          addons: mappedAddons,
          daysRemaining: 0,
          showExpiryAlert: false,
          reason: 'LICENSE_EXPIRED',
          licenseState: 'expired',
        }
      }

      if (licenseStatus === 'trial_expired') {
        saveLicenseFile(
          {
            ...licenseFile,
            plan: 'trial',
            expiresAt,
            licenseState: 'trial_expired',
            lastCloudValidation: new Date().toISOString(),
          },
          fingerprint
        )
        return {
          valid: false,
          plan: 'trial',
          expiresAt,
          modules: [],
          addons: [],
          daysRemaining: 0,
          showExpiryAlert: false,
          reason: 'TRIAL_EXPIRED',
          licenseState: 'trial_expired',
          maxTerminals: 1,
        }
      }

      // Determine license state from cloud
      const newState = cloud.is_linked ? 'linked' : 'activated'

      const maxTerminals = cloud.max_terminals ?? 1
      const maxRegisters = cloud.max_registers ?? 1

      // Update license file with cloud data
      saveLicenseFile(
        {
          ...licenseFile,
          plan,
          expiresAt,
          addons: mappedAddons,
          businessId: cloud.business?.id ?? licenseFile.businessId,
          branchId: cloud.branch?.id ?? licenseFile.branchId,
          terminalId: cloud.terminal?.id ?? licenseFile.terminalId,
          lastCloudValidation: new Date().toISOString(),
          licenseState: newState,
          maxTerminals,
          maxRegisters,
          stamps: cloud.stamps_available != null
            ? { available: cloud.stamps_available, totalPurchased: 0, totalUsed: 0 }
            : licenseFile.stamps,
        },
        fingerprint
      )

      const daysRemaining = getDaysRemaining(expiresAt)

      return {
        valid: cloud.valid && daysRemaining > 0,
        plan,
        expiresAt,
        modules: licenseFile.modules,
        addons: mappedAddons,
        daysRemaining,
        showExpiryAlert: daysRemaining <= 5 && daysRemaining > 0,
        reason: daysRemaining <= 0 ? 'LICENSE_EXPIRED' : undefined,
        licenseState: newState,
        maxTerminals,
        maxRegisters,
        stampsAvailable: cloud.stamps_available ?? undefined,
      }
    }

    // ─── HTTP error response (non-200) — try to detect revocation ───
    // Cloud returns 403 { detail: "Licencia revocada" } when terminal token is revoked
    console.log(`[validator] Non-200 response, parsing error body...`)
    try {
      const rawText = await response.text()
      console.log(`[validator] Error body raw: ${rawText}`)
      const errorBody = JSON.parse(rawText) as { message?: string; detail?: string; status?: string; license?: { status?: string } }
      const errorStatus = errorBody.license?.status || errorBody.status || ''
      const errorText = (errorBody.message || errorBody.detail || '').toLowerCase()
      console.log(`[validator] errorStatus="${errorStatus}" errorText="${errorText}"`)

      if (errorStatus === 'revoked' || errorText.includes('revok') || errorText.includes('revoc')) {
        console.log('[validator] REVOCATION DETECTED — deleting license file')
        deleteLicenseFile()
        return {
          valid: false,
          plan: licenseFile.plan,
          expiresAt: licenseFile.expiresAt,
          modules: [],
          addons: [],
          daysRemaining: 0,
          showExpiryAlert: false,
          reason: 'LICENSE_REVOKED',
          licenseState: 'revoked',
        }
      }
    } catch (parseErr) {
      console.log(`[validator] Failed to parse error body: ${(parseErr as Error).message}`)
    }
  } catch (netErr) {
    console.log(`[validator] Network/fetch error: ${(netErr as Error).message}`)
  }

  console.log(`[validator] Falling through to offline. licenseState="${licenseFile.licenseState}" lastCloud="${licenseFile.lastCloudValidation}"`)

  // ─── Check local licenseState before offline fallback ───
  // If the file already has a revoked/expired state from a previous cloud check, honor it
  if (licenseFile.licenseState === 'revoked') {
    deleteLicenseFile()
    return {
      valid: false,
      plan: licenseFile.plan,
      expiresAt: licenseFile.expiresAt,
      modules: [],
      addons: [],
      daysRemaining: 0,
      showExpiryAlert: false,
      reason: 'LICENSE_REVOKED',
      licenseState: 'revoked',
    }
  }

  if (licenseFile.licenseState === 'expired') {
    return {
      valid: false,
      plan: licenseFile.plan,
      expiresAt: licenseFile.expiresAt,
      modules: [],
      addons: licenseFile.addons,
      daysRemaining: 0,
      showExpiryAlert: false,
      reason: 'LICENSE_EXPIRED',
      licenseState: 'expired',
    }
  }

  // OFFLINE VALIDATION — 7-day grace period
  const daysSinceCloudCheck = getDaysSince(licenseFile.lastCloudValidation)

  if (daysSinceCloudCheck > 7) {
    return {
      valid: false,
      plan: licenseFile.plan,
      expiresAt: licenseFile.expiresAt,
      modules: licenseFile.modules,
      addons: licenseFile.addons,
      daysRemaining: getDaysRemaining(licenseFile.expiresAt),
      showExpiryAlert: false,
      reason: 'OFFLINE_GRACE_EXPIRED',
      licenseState: licenseFile.licenseState,
      maxTerminals: licenseFile.maxTerminals,
      maxRegisters: licenseFile.maxRegisters,
    }
  }

  const daysRemaining = getDaysRemaining(licenseFile.expiresAt)

  return {
    valid: daysRemaining > 0,
    plan: licenseFile.plan,
    expiresAt: licenseFile.expiresAt,
    modules: licenseFile.modules,
    addons: licenseFile.addons,
    daysRemaining,
    showExpiryAlert: daysRemaining <= 5 && daysRemaining > 0,
    reason: daysRemaining <= 0 ? 'LICENSE_EXPIRED' : undefined,
    licenseState: licenseFile.licenseState,
    maxTerminals: licenseFile.maxTerminals,
    maxRegisters: licenseFile.maxRegisters,
    stampsAvailable: licenseFile.stamps?.available,
  }
}

// ─── STAGE 3: Login with PIN ────────────────────────────────
// POST /api/v1/pos/desktop/login?pin=123456
export async function loginWithPin(config: {
  cloudApiUrl: string
  pin: string
  productCode?: string
}): Promise<SessionResult> {
  const fingerprint = generateFingerprint()
  const licenseFile = readLicenseFile(fingerprint)

  if (!licenseFile?.terminalToken) {
    throw new Error('No terminal token. License must be activated first.')
  }

  const params = new URLSearchParams({ pin: config.pin })

  const headers: Record<string, string> = {
    'X-Terminal-Token': licenseFile.terminalToken,
    'X-Hardware-Fingerprint': fingerprint,
    'Content-Type': 'application/json',
  }

  if (config.productCode) {
    headers['X-Product-Code'] = config.productCode
  }

  const response = await fetch(`${config.cloudApiUrl}/api/v1/pos/desktop/login?${params}`, {
    method: 'POST',
    headers,
  })

  if (!response.ok) {
    const err = (await response.json()) as { message?: string }
    throw new Error(err.message || 'Login failed')
  }

  return (await response.json()) as SessionResult
}
