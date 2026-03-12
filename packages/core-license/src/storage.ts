import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { LicenseFile } from './types'

const ALGORITHM = 'aes-256-gcm'

// 3.4 — Per-machine salt: derive from OS hostname + username for uniqueness
function getSalt(): string {
  const os = require('os')
  return `enlocal-${os.hostname()}-${os.userInfo().username}-2025`
}

let _licenseDirOverride: string | null = null

export function setLicenseDir(dir: string): void {
  _licenseDirOverride = dir
}

function getLicensePath(): string {
  if (_licenseDirOverride) {
    return path.join(_licenseDirOverride, '.enlocal-license')
  }
  try {
    const { app } = require('electron')
    return path.join(app.getPath('userData'), '.enlocal-license')
  } catch {
    return path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.enlocal-license')
  }
}

const LEGACY_SALT = 'enlocal-suite-2025'

function deriveKey(fingerprint: string, salt?: string): Buffer {
  return crypto.pbkdf2Sync(fingerprint, salt ?? getSalt(), 100000, 32, 'sha512')
}

export function saveLicenseFile(data: LicenseFile, fingerprint: string): void {
  const key = deriveKey(fingerprint)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  const fileContent = {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
  }

  const licensePath = getLicensePath()
  const dir = path.dirname(licensePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(licensePath, JSON.stringify(fileContent))
}

export function readLicenseFile(fingerprint: string): LicenseFile | null {
  const licensePath = getLicensePath()
  if (!fs.existsSync(licensePath)) return null

  const fileContent = JSON.parse(fs.readFileSync(licensePath, 'utf8'))

  // Try new per-machine salt first
  try {
    const key = deriveKey(fingerprint)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(fileContent.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(fileContent.authTag, 'hex'))
    let decrypted = decipher.update(fileContent.data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return JSON.parse(decrypted)
  } catch {
    // Fallback to legacy salt for existing installations
    try {
      const legacyKey = deriveKey(fingerprint, LEGACY_SALT)
      const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, Buffer.from(fileContent.iv, 'hex'))
      decipher.setAuthTag(Buffer.from(fileContent.authTag, 'hex'))
      let decrypted = decipher.update(fileContent.data, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      const data = JSON.parse(decrypted) as LicenseFile
      // Re-save with new salt for future reads
      try { saveLicenseFile(data, fingerprint) } catch { /* non-critical */ }
      return data
    } catch {
      return null
    }
  }
}

export function deleteLicenseFile(): void {
  const licensePath = getLicensePath()
  if (fs.existsSync(licensePath)) {
    fs.unlinkSync(licensePath)
  }
}
