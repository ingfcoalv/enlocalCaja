import { Router } from 'express'
import { getConnectedDevices } from '@enlocal/core-server'
import { readLicenseFile, generateFingerprint } from '@enlocal/core-license'

const router = Router()

router.get('/status', (_req, res) => {
  const devices = getConnectedDevices()

  let maxConnections = 1
  try {
    const fingerprint = generateFingerprint()
    const license = readLicenseFile(fingerprint)
    if (license?.maxTerminals) {
      maxConnections = license.maxTerminals
    }
  } catch {
    // Default to 1 if license can't be read
  }

  res.json({
    current: devices.length,
    max: maxConnections,
    devices: devices.map(d => ({
      userId: d.userId,
      userName: d.userName,
      deviceType: d.deviceType,
      connectedAt: d.connectedAt,
    })),
  })
})

export default router
