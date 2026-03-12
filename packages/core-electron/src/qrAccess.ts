import os from 'os'
import QRCode from 'qrcode'

export function getLocalIP(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

export async function generateAccessQR(port: number): Promise<string> {
  const ip = getLocalIP()
  const url = `http://${ip}:${port}`
  return QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })
}
