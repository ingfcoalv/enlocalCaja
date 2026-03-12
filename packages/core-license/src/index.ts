// @enlocal/core-license — Sistema de licenciamiento
// Exports: fingerprint, validator, storage, moduleAccess, alerts, types,
//          headersBuilder, moduleActivation, v2Sync

export { generateFingerprint, getHardwareDetails } from './fingerprint'
export { saveLicenseFile, readLicenseFile, deleteLicenseFile, setLicenseDir } from './storage'
export { validateLicense, activateLicense, loginWithPin, registerTrial, startOfflineTrial, getTrialStatus } from './validator'
export { getEnabledModules, hasModuleAccess, SOFTWARE_MODULES, MODULE_DEPENDENCIES, validateModuleDependencies } from './moduleAccess'
export { checkAndShowExpiryAlert } from './alerts'

// Cloud headers
export { buildCloudHeaders, buildSessionHeaders, getTerminalToken } from './headersBuilder'
export type { CloudHeaders, SessionHeaders } from './headersBuilder'

// Module activation (settings-based)
export {
  getActiveModules,
  isModuleActive,
  getAllModulesWithStatus,
  getStampsBalance,
  updateLocalStampsAfterUse,
  syncLicenseToSettings,
} from './moduleActivation.service'
export type { StampsBalance, ModuleStatus, LicenseSyncData } from './moduleActivation.service'

// V2 license sync
export { fetchFullLicenseStatus } from './v2Sync'

// Types
export type {
  LicenseFile,
  LicenseState,
  ValidationResult,
  ActivationResult,
  SessionResult,
  LicenseFullStatus,
  HardwareDetails,
  CloudActivationResponse,
  CloudValidationResponse,
  CloudTrialResponse,
  CloudTrialErrorResponse,
  TrialStatus,
} from './types'
