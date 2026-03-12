export interface HardwareDetails {
  machineId: string
  hostname: string
  platform: string
  cpuModel: string
  cpuCores: number
  totalMemory: number
  macAddress: string
  diskSerial: string
}

export type LicenseState = 'pending' | 'activated' | 'linked' | 'expired' | 'revoked' | 'trial' | 'trial_expired'

export interface LicenseFile {
  installationHash?: string
  fingerprint: string
  licenseKey: string
  appId: string
  plan: string
  expiresAt: string
  modules: string[]
  addons: string[]
  businessId: string
  branchId: string
  terminalId: string
  lastCloudValidation: string
  serverSignature?: string

  // Terminal token auth (3-stage)
  terminalToken?: string
  licenseState?: LicenseState

  // Stamps
  stamps?: {
    available: number
    totalPurchased: number
    totalUsed: number
  }

  // Max terminals allowed (from cloud validation)
  maxTerminals?: number

  // Max registers allowed for multi-caja (from cloud validation)
  maxRegisters?: number

  // Trial fields
  trialStartedAt?: string
  trialEndsAt?: string
  trialRegistered?: boolean
  offlineTrialStartedAt?: string
}

export interface ValidationResult {
  valid: boolean
  plan: string
  expiresAt: string
  modules: string[]
  addons: string[]
  daysRemaining: number
  showExpiryAlert: boolean
  reason?: string
  licenseState?: LicenseState
  maxTerminals?: number
  maxRegisters?: number
  stampsAvailable?: number
}

export interface ActivationResult {
  message: string
  terminalToken: string
  plan: string
  expiresAt: string
  modules: string[]
  addons: string[]
  businessId: string
  branchId: string
  terminalId: string
}

// ─── Cloud API response shapes ───────────────────────────────

export interface CloudActivationResponse {
  message: string
  terminal_token: string
  license: {
    id: string
    serial_number: string
    status: string
    pos_type: string
    product_id: string
    business_id: string
    branch_id: string | null
    terminal_id: string | null
    valid_from: string
    valid_until: string
    [key: string]: unknown
  }
}

export interface CloudValidationResponse {
  valid: boolean
  license: {
    id: string
    serial_number: string
    status: string
    pos_type: string
    product_id: string
    business_id: string
    branch_id: string
    terminal_id: string
    valid_until: string
    last_seen: string
    [key: string]: unknown
  }
  business: {
    id: string
    name: string
    rfc: string
    address?: string
    logo_url?: string
  }
  branch: {
    id: string
    name: string
  }
  terminal: {
    id: string
    name?: string
  }
  product: {
    id: string
    code: string
    name: string
  }
  is_linked: boolean
  addons: string[]
  stamps_available: number
  max_terminals: number
  max_registers?: number
}

export interface SessionResult {
  session_token: string
  session_id: string
  terminal: {
    id: string
    name: string
  }
  cashier: {
    id: string
    name: string
  }
  branch: {
    id: string
    name: string
  }
  business: {
    id: string
    name: string
    rfc: string
    phone?: string
    address?: string
    logo_url?: string
  }
  license: {
    id: string
    pos_type: string
    serial_number: string
    product_code: string
  }
}

export interface LicenseFullStatus {
  status: string
  plan: string
  expiresAt: string
  modules: string[]
  addons: string[]
  signature: string
  licenseState?: LicenseState
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

// ─── Cloud Trial API response shapes ─────────────────────────

export interface CloudTrialResponse {
  message: string
  trial: {
    id: string
    hardware_fingerprint: string
    product_code: string
    started_at: string
    ends_at: string
    status: 'active' | 'expired'
  }
  terminal_token: string
}

export interface CloudTrialErrorResponse {
  message: string
  trial: {
    id: string
    started_at: string
    ends_at: string
    status: 'expired'
  }
}

export interface TrialStatus {
  isTrial: boolean
  isRegistered: boolean
  trialEndsAt: string | null
  daysRemaining: number
  offlineGraceExpired: boolean
  isExpired: boolean
}
