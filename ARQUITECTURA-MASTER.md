# enLocal Suite — Arquitectura Master y Plan de Desarrollo

## 1. Visión General

Suite de software empresarial basada en Electron + PostgreSQL con licenciamiento centralizado, módulos compartidos reutilizables y sincronización a la nube TodoEnLocal.com.

### 1.1 Aplicaciones a Desarrollar

| App | ID interno | Descripción | Multi-usuario LAN | Puerto default |
|-----|-----------|-------------|-------------------|----------------|
| enLocal Facturación | `enlocal-facturacion` | Facturación electrónica CFDI | No | 9001 |
| enLocal Nóminas | `enlocal-nominas` | Gestión de nómina y empleados | No | 9002 |
| enLocal ERP | `enlocal-erp` | Planeación de recursos empresarial | Sí (QR) | 9003 |
| enLocal Servicios | `enlocal-servicios` | Gestión de servicios y citas | Sí (QR) | 9004 |
| enLocal Caja | `enlocal-caja` | Punto de venta retail | No | 9005 |

### 1.2 Stack Tecnológico

| Componente | Tecnología | Versión | Notas |
|------------|-----------|---------|-------|
| Runtime | Node.js | >= 18 | |
| Desktop | Electron | 31.x | Reutilizamos versión de Comanda Pro |
| HTTP Server | Express | 4.19.x | Servidor local por app |
| Base de datos local | PostgreSQL | 16+ | Embebido o servicio local |
| ORM | Drizzle ORM | latest | Type-safe, soporte PostgreSQL |
| Tiempo real | Socket.io | 4.7.x | Multi-usuario LAN |
| Auth | jsonwebtoken + bcryptjs | 9.x / 2.x | |
| Config | conf (electron-store) | 10.x | Cifrado para licencias |
| Frontend | React | 18.x | UI independiente por app |
| Build | Vite | 5.x | |
| CSS | Tailwind CSS | 3.x | Tema diferente por app |
| State | Zustand | 5.x | |
| HTTP Client | Axios | 1.7.x | |
| Icons | Lucide React | latest | |
| QR | qrcode | 1.5.x | Para acceso LAN |
| Monorepo | Turborepo + pnpm | latest | |
| Empaquetado | electron-builder | latest | NSIS installer Windows |
| Auto-update | electron-updater | latest | |

### 1.3 PostgreSQL Local — Estrategia

En lugar de SQLite usaremos PostgreSQL. Opciones para distribución:

**Opción recomendada: PostgreSQL como servicio del sistema**
- El instalador NSIS detecta si PostgreSQL está instalado
- Si no existe, lo instala silenciosamente (PostgreSQL portable o installer silencioso)
- Cada app crea su propia base de datos: `enlocal_facturacion`, `enlocal_erp`, etc.
- Conexión via pg pool: `postgresql://enlocal:password@localhost:5432/enlocal_facturacion`

**Alternativa: Embedded PostgreSQL (embedded-postgres)**
- Usa `embedded-postgres` npm package
- PostgreSQL binarios embebidos dentro de Electron
- Sin instalación separada pero aumenta tamaño del instalador (~100MB)

---

## 2. Estructura del Monorepo

```
enlocal-suite/
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json                      # Turborepo pipeline config
├── tsconfig.base.json              # TypeScript base config
│
├── packages/
│   │
│   ├── core-electron/              # Shell Electron reutilizable
│   │   ├── src/
│   │   │   ├── createApp.ts            # Factory para crear app Electron
│   │   │   ├── windowManager.ts        # Gestión de ventanas BrowserWindow
│   │   │   ├── tray.ts                 # System tray con menú contextual
│   │   │   ├── qrAccess.ts             # QR para acceso LAN (multi-usuario)
│   │   │   └── ipc/
│   │   │       ├── index.ts            # Registro central de IPC handlers
│   │   │       ├── serverHandlers.ts   # get-server-info, restart-server
│   │   │       ├── licenseHandlers.ts  # activate-license, get-license-info
│   │   │       └── updateHandlers.ts   # check-update, install-update
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core-license/               # Sistema de licenciamiento
│   │   ├── src/
│   │   │   ├── fingerprint.ts          # Hardware fingerprint (MAC + CPU + disk + hostname)
│   │   │   ├── validator.ts            # Validación online/offline de licencia
│   │   │   ├── storage.ts             # Archivo cifrado .enlocal-license
│   │   │   ├── alerts.ts              # Alertas de vencimiento (5 días antes)
│   │   │   ├── moduleAccess.ts        # Verificar acceso a módulos según licencia
│   │   │   └── types.ts              # Interfaces de licencia
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core-updater/               # Auto-actualizaciones
│   │   ├── src/
│   │   │   ├── updater.ts             # electron-updater wrapper
│   │   │   ├── backup.ts              # Backup de PostgreSQL antes de actualizar
│   │   │   ├── healthCheck.ts         # Verificación post-update
│   │   │   ├── channels.ts           # Canales beta/stable
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core-db/                    # Base de datos compartida
│   │   ├── src/
│   │   │   ├── connection.ts          # Pool de conexión PostgreSQL
│   │   │   ├── migrator.ts            # Sistema de migraciones
│   │   │   └── schema/               # Schemas Drizzle compartidos
│   │   │       ├── index.ts
│   │   │       ├── users.ts           # staff/usuarios
│   │   │       ├── roles.ts           # roles y permisos
│   │   │       ├── customers.ts       # catálogo de clientes
│   │   │       ├── products.ts        # catálogo de productos
│   │   │       ├── services.ts        # catálogo de servicios
│   │   │       ├── sections.ts        # catálogo de secciones
│   │   │       ├── suppliers.ts       # catálogo de proveedores
│   │   │       ├── invoices.ts        # facturación CFDI
│   │   │       ├── settings.ts        # configuración key-value
│   │   │       ├── changeJournal.ts   # auditoría + sync
│   │   │       └── syncState.ts       # estado de sincronización
│   │   ├── migrations/              # Archivos de migración SQL
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core-server/                # Express base compartido
│   │   ├── src/
│   │   │   ├── createServer.ts        # Factory Express + middleware base
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts            # JWT auth middleware
│   │   │   │   ├── permissions.ts     # Verificación de permisos por módulo
│   │   │   │   ├── moduleGuard.ts     # Bloquea rutas de módulos no licenciados
│   │   │   │   └── errorHandler.ts    # Error handling centralizado
│   │   │   ├── realtime/
│   │   │   │   └── socketHandler.ts   # Socket.io setup + auth
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core-sync/                  # Sincronización con la nube
│   │   ├── src/
│   │   │   ├── syncEngine.ts          # Motor de push/pull
│   │   │   ├── pushService.ts         # Local → Nube
│   │   │   ├── pullService.ts         # Nube → Local
│   │   │   ├── wsClient.ts            # WebSocket client a TodoEnLocal
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core-printing/              # Sistema de impresión ESC/POS
│   │   ├── src/
│   │   │   ├── escposCommands.ts      # Comandos ESC/POS base
│   │   │   ├── printerManager.ts      # TCP socket a impresoras
│   │   │   ├── printQueue.ts          # Cola con reintentos
│   │   │   ├── ticketBuilder.ts       # Generador de tickets genérico
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── react-hooks/                # Hooks React compartidos
│   │   ├── src/
│   │   │   ├── useAuth.ts             # Login/logout/session
│   │   │   ├── useCRUD.ts             # Hook genérico CRUD
│   │   │   ├── useSocket.ts           # Conexión Socket.io
│   │   │   ├── useConnection.ts       # Estado de conexión
│   │   │   ├── useLicense.ts          # Info de licencia en UI
│   │   │   ├── useModuleAccess.ts     # Verificar acceso a módulo desde UI
│   │   │   └── useToast.ts            # Notificaciones
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── react-components/           # Componentes React compartidos (headless/base)
│   │   ├── src/
│   │   │   ├── LicenseAlert.tsx       # Banner de vencimiento de licencia
│   │   │   ├── UpdatePrompt.tsx       # Diálogo de actualización
│   │   │   ├── QRAccessPanel.tsx      # Panel QR para acceso LAN
│   │   │   ├── ModuleGate.tsx         # Wrapper que oculta módulos no licenciados
│   │   │   ├── LoginScreen.tsx        # Pantalla de login base (personalizable)
│   │   │   └── ActivationScreen.tsx   # Pantalla de activación de licencia
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   │── MÓDULOS DE NEGOCIO ──────────────────────────────────
│   │
│   ├── mod-config/                 # Módulo: Configuración
│   │   ├── src/
│   │   │   ├── routes/                # Express routes
│   │   │   │   ├── users.routes.ts        # CRUD usuarios
│   │   │   │   ├── roles.routes.ts        # CRUD roles
│   │   │   │   └── settings.routes.ts     # Config general
│   │   │   ├── services/              # Lógica de negocio
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── roles.service.ts
│   │   │   │   └── settings.service.ts
│   │   │   ├── validators/            # Validación con zod
│   │   │   └── index.ts              # Export: mountRoutes()
│   │   └── package.json
│   │
│   ├── mod-catalogs/               # Módulo: Catálogos
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── products.routes.ts
│   │   │   │   ├── services.routes.ts
│   │   │   │   ├── categories.routes.ts
│   │   │   │   ├── sections.routes.ts
│   │   │   │   ├── customers.routes.ts
│   │   │   │   └── suppliers.routes.ts
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mod-invoicing/              # Módulo: Facturación CFDI
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── invoices.routes.ts
│   │   │   │   ├── cfdi.routes.ts         # Timbrado, cancelación
│   │   │   │   └── fiscalData.routes.ts   # Datos fiscales
│   │   │   ├── services/
│   │   │   │   ├── cfdiBuilder.ts         # Generador XML CFDI 4.0
│   │   │   │   ├── pacService.ts          # Conexión a PAC
│   │   │   │   └── pdfGenerator.ts        # PDF de factura
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mod-payroll/                # Módulo: Nómina
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── employees.routes.ts
│   │   │   │   ├── payroll.routes.ts
│   │   │   │   └── payrollCfdi.routes.ts  # CFDI de nómina
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mod-pos/                    # Módulo: Punto de Venta
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── sales.routes.ts
│   │   │   │   ├── cashShifts.routes.ts
│   │   │   │   ├── payments.routes.ts
│   │   │   │   └── receipts.routes.ts
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mod-inventory/              # Módulo: Inventario
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── stock.routes.ts
│   │   │   │   ├── movements.routes.ts
│   │   │   │   └── alerts.routes.ts
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mod-appointments/           # Módulo: Citas/Agenda
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── appointments.routes.ts
│   │   │   │   └── schedule.routes.ts
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── mod-reports/                # Módulo: Reportes
│       ├── src/
│       │   ├── routes/
│       │   │   ├── dashboard.routes.ts
│       │   │   ├── salesReports.routes.ts
│       │   │   └── audit.routes.ts
│       │   ├── services/
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   ├── facturacion/                # enLocal Facturación
│   │   ├── electron/
│   │   │   ├── main.ts                # Entry point Electron
│   │   │   └── server/
│   │   │       └── index.ts           # Express server con módulos montados
│   │   ├── webapp/                    # React app (UI propia)
│   │   │   ├── src/
│   │   │   │   ├── App.tsx
│   │   │   │   ├── pages/
│   │   │   │   ├── components/
│   │   │   │   ├── stores/
│   │   │   │   ├── styles/
│   │   │   │   │   └── theme.css      # Tema propio: colores, branding
│   │   │   │   └── tailwind.config.js # Paleta de colores propia
│   │   │   ├── vite.config.ts
│   │   │   └── index.html
│   │   ├── electron-builder.yml       # Config de empaquetado
│   │   └── package.json
│   │
│   ├── nominas/                    # enLocal Nóminas (misma estructura)
│   │   ├── electron/
│   │   ├── webapp/
│   │   ├── electron-builder.yml
│   │   └── package.json
│   │
│   ├── erp/                        # enLocal ERP
│   │   ├── electron/
│   │   ├── webapp/
│   │   ├── electron-builder.yml
│   │   └── package.json
│   │
│   ├── servicios/                  # enLocal Servicios
│   │   ├── electron/
│   │   ├── webapp/
│   │   ├── electron-builder.yml
│   │   └── package.json
│   │
│   └── caja/                       # enLocal Caja
│       ├── electron/
│       ├── webapp/
│       ├── electron-builder.yml
│       └── package.json
│
└── tools/
    └── scripts/
        ├── create-app.ts           # Script para scaffoldear nueva app
        └── create-module.ts        # Script para scaffoldear nuevo módulo
```

---

## 3. Sistema de Licenciamiento (Detallado)

### 3.1 Fingerprint de Hardware

```typescript
// packages/core-license/src/fingerprint.ts
import { machineIdSync } from 'node-machine-id'
import os from 'os'
import { execSync } from 'child_process'
import crypto from 'crypto'

interface HardwareDetails {
  machineId: string      // ID único del OS
  hostname: string
  platform: string
  cpuModel: string
  cpuCores: number
  totalMemory: number
  macAddress: string     // Primera MAC no-interna
  diskSerial: string     // Serial del disco principal (Windows: wmic)
}

export function getHardwareDetails(): HardwareDetails { ... }

export function generateFingerprint(): string {
  const hw = getHardwareDetails()
  // Hash determinista: misma máquina = mismo hash
  const raw = `${hw.machineId}|${hw.macAddress}|${hw.diskSerial}|${hw.hostname}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}
```

### 3.2 Archivo de Licencia Cifrado

```typescript
// packages/core-license/src/storage.ts
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// Clave de cifrado derivada del fingerprint + salt fijo
// Así el archivo SOLO se puede descifrar en la misma máquina
const SALT = 'enlocal-suite-2025'
const ALGORITHM = 'aes-256-gcm'

interface LicenseFile {
  installationHash: string     // Hash generado por TodoEnLocal al activar
  fingerprint: string          // Fingerprint de esta máquina
  licenseKey: string           // Serial de la licencia
  appId: string                // 'enlocal-facturacion', etc.
  plan: string                 // 'basic', 'pro', 'enterprise'
  expiresAt: string            // ISO date
  modules: string[]            // Módulos habilitados
  addons: string[]             // Addons extra comprados
  businessId: string
  branchId: string
  terminalId: string
  lastCloudValidation: string  // ISO date
  serverSignature: string      // Firma del servidor para verificar integridad
}

function deriveKey(fingerprint: string): Buffer {
  return crypto.pbkdf2Sync(fingerprint, SALT, 100000, 32, 'sha512')
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
    data: encrypted
  }
  
  const licensePath = path.join(app.getPath('userData'), '.enlocal-license')
  fs.writeFileSync(licensePath, JSON.stringify(fileContent))
}

export function readLicenseFile(fingerprint: string): LicenseFile | null {
  const licensePath = path.join(app.getPath('userData'), '.enlocal-license')
  if (!fs.existsSync(licensePath)) return null
  
  try {
    const fileContent = JSON.parse(fs.readFileSync(licensePath, 'utf8'))
    const key = deriveKey(fingerprint)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(fileContent.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(fileContent.authTag, 'hex'))
    
    let decrypted = decipher.update(fileContent.data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return JSON.parse(decrypted)
  } catch {
    return null // Archivo corrupto o máquina diferente
  }
}
```

### 3.3 Validación de Licencia

```typescript
// packages/core-license/src/validator.ts

export interface ValidationResult {
  valid: boolean
  plan: string
  expiresAt: string
  modules: string[]         // Módulos habilitados
  addons: string[]          // Addons comprados
  daysRemaining: number
  showExpiryAlert: boolean  // true si <= 5 días
  reason?: string           // Si no es válida, por qué
}

export async function validateLicense(config: {
  cloudApiUrl: string
  appId: string
}): Promise<ValidationResult> {
  
  const fingerprint = generateFingerprint()
  const licenseFile = readLicenseFile(fingerprint)
  
  if (!licenseFile) {
    return { valid: false, reason: 'NO_LICENSE_FILE' }
  }
  
  // Verificar que el fingerprint coincida
  if (licenseFile.fingerprint !== fingerprint) {
    return { valid: false, reason: 'HARDWARE_MISMATCH' }
  }
  
  // Intentar validación online
  try {
    const response = await fetch(`${config.cloudApiUrl}/api/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationHash: licenseFile.installationHash,
        fingerprint,
        appId: config.appId,
        licenseKey: licenseFile.licenseKey,
      })
    })
    
    if (response.ok) {
      const cloud = await response.json()
      
      // El servidor puede haber revocado la licencia
      if (cloud.status === 'revoked') {
        // Borrar archivo de licencia local
        deleteLicenseFile()
        return { valid: false, reason: 'LICENSE_REVOKED' }
      }
      
      // Actualizar archivo local con datos frescos del servidor
      saveLicenseFile({
        ...licenseFile,
        plan: cloud.plan,
        expiresAt: cloud.expiresAt,
        modules: cloud.modules,
        addons: cloud.addons,
        lastCloudValidation: new Date().toISOString(),
        serverSignature: cloud.signature,
      }, fingerprint)
      
      const daysRemaining = getDaysRemaining(cloud.expiresAt)
      
      return {
        valid: cloud.status === 'active' && daysRemaining > 0,
        plan: cloud.plan,
        expiresAt: cloud.expiresAt,
        modules: cloud.modules,
        addons: cloud.addons,
        daysRemaining,
        showExpiryAlert: daysRemaining <= 5 && daysRemaining > 0,
        reason: daysRemaining <= 0 ? 'LICENSE_EXPIRED' : undefined,
      }
    }
  } catch {
    // Sin internet — validación offline
  }
  
  // VALIDACIÓN OFFLINE
  const daysSinceCloudCheck = getDaysSince(licenseFile.lastCloudValidation)
  
  // Gracia offline: 7 días sin poder contactar al servidor
  if (daysSinceCloudCheck > 7) {
    return { valid: false, reason: 'OFFLINE_GRACE_EXPIRED' }
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
  }
}
```

### 3.4 Activación de Licencia

```typescript
// packages/core-license/src/validator.ts (continuación)

export async function activateLicense(config: {
  cloudApiUrl: string
  appId: string
  serialKey: string
}): Promise<ActivationResult> {
  
  const fingerprint = generateFingerprint()
  const hardware = getHardwareDetails()
  
  const response = await fetch(`${config.cloudApiUrl}/api/v1/licenses/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serial: config.serialKey,
      fingerprint,
      hardware,
      appId: config.appId,
    })
  })
  
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.message) // 'Serial inválido', 'Ya activado en otro equipo', etc.
  }
  
  const result = await response.json()
  // result: { installationHash, plan, expiresAt, modules, addons,
  //           businessId, branchId, terminalId, token, signature }
  
  // Guardar archivo cifrado
  saveLicenseFile({
    installationHash: result.installationHash,
    fingerprint,
    licenseKey: config.serialKey,
    appId: config.appId,
    plan: result.plan,
    expiresAt: result.expiresAt,
    modules: result.modules,
    addons: result.addons,
    businessId: result.businessId,
    branchId: result.branchId,
    terminalId: result.terminalId,
    lastCloudValidation: new Date().toISOString(),
    serverSignature: result.signature,
  }, fingerprint)
  
  return result
}
```

### 3.5 Sistema de Módulos y Addons

```typescript
// packages/core-license/src/moduleAccess.ts

// Definición de módulos por software y plan
export const SOFTWARE_MODULES: Record<string, {
  default: string[]   // Incluidos en la licencia básica
  addons: string[]    // Requieren addon comprado
}> = {
  'enlocal-facturacion': {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-reports'],
    addons: ['mod-inventory', 'mod-pos'],
  },
  'enlocal-nominas': {
    default: ['mod-config', 'mod-catalogs', 'mod-payroll', 'mod-reports'],
    addons: ['mod-invoicing'],
  },
  'enlocal-erp': {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-inventory',
              'mod-pos', 'mod-payroll', 'mod-reports'],
    addons: ['mod-appointments'],
  },
  'enlocal-servicios': {
    default: ['mod-config', 'mod-catalogs', 'mod-appointments', 'mod-invoicing', 'mod-reports'],
    addons: ['mod-inventory', 'mod-pos'],
  },
  'enlocal-caja': {
    default: ['mod-config', 'mod-catalogs', 'mod-pos', 'mod-reports'],
    addons: ['mod-invoicing', 'mod-inventory'],
  },
}

export function getEnabledModules(appId: string, plan: string, addons: string[]): string[] {
  const appModules = SOFTWARE_MODULES[appId]
  if (!appModules) return []
  
  // Los módulos default siempre están habilitados
  const enabled = [...appModules.default]
  
  // Agregar addons que el usuario haya comprado
  for (const addon of addons) {
    if (appModules.addons.includes(addon)) {
      enabled.push(addon)
    }
  }
  
  return enabled
}

export function hasModuleAccess(
  enabledModules: string[],
  requiredModule: string
): boolean {
  return enabledModules.includes(requiredModule)
}
```

---

## 4. Cómo se Monta una App

### 4.1 Server de cada App (Express + Módulos)

```typescript
// apps/facturacion/electron/server/index.ts
import express from 'express'
import { createBaseServer } from '@enlocal/core-server'
import { createDbPool } from '@enlocal/core-db'
import { mountConfigRoutes } from '@enlocal/mod-config'
import { mountCatalogRoutes } from '@enlocal/mod-catalogs'
import { mountInvoicingRoutes } from '@enlocal/mod-invoicing'
import { mountReportRoutes } from '@enlocal/mod-reports'
// Addons (se montan condicionalmente)
import { mountInventoryRoutes } from '@enlocal/mod-inventory'
import { mountPosRoutes } from '@enlocal/mod-pos'

export async function startServer(config: {
  port: number
  dbName: string
  enabledModules: string[]
  multiuser: boolean
}) {
  const db = await createDbPool({ database: config.dbName })
  const { app, io, httpServer } = createBaseServer({ db })

  // Módulos default — siempre se montan
  mountConfigRoutes(app, db)
  mountCatalogRoutes(app, db)
  mountInvoicingRoutes(app, db)
  mountReportRoutes(app, db)

  // Addons — solo si la licencia los incluye
  if (config.enabledModules.includes('mod-inventory')) {
    mountInventoryRoutes(app, db)
  }
  if (config.enabledModules.includes('mod-pos')) {
    mountPosRoutes(app, db)
  }

  // Servir webapp estática
  app.use(express.static('webapp/dist'))
  app.get('*', (req, res) => res.sendFile('webapp/dist/index.html'))

  const host = config.multiuser ? '0.0.0.0' : '127.0.0.1'
  httpServer.listen(config.port, host)

  return { app, io, httpServer, db }
}
```

### 4.2 Main de Electron por App

```typescript
// apps/facturacion/electron/main.ts
import { createEnLocalApp } from '@enlocal/core-electron'
import { validateLicense, activateLicense } from '@enlocal/core-license'
import { setupAutoUpdate } from '@enlocal/core-updater'
import { startServer } from './server'

const APP_CONFIG = {
  appId: 'enlocal-facturacion',
  appName: 'enLocal Facturación',
  port: 9001,
  dbName: 'enlocal_facturacion',
  multiuser: false,
  cloudApiUrl: 'https://todoenlocal.com',
  theme: {
    primaryColor: '#2563eb',    // Azul para Facturación
    icon: './assets/icon-facturacion.png',
  }
}

createEnLocalApp({
  ...APP_CONFIG,
  onReady: async (win) => {
    // 1. Validar licencia
    const license = await validateLicense({
      cloudApiUrl: APP_CONFIG.cloudApiUrl,
      appId: APP_CONFIG.appId,
    })

    if (!license.valid) {
      // Mostrar pantalla de activación
      win.loadFile('activation.html')
      return
    }

    // 2. Mostrar alerta de vencimiento si aplica
    if (license.showExpiryAlert) {
      // Se maneja vía IPC → LicenseAlert component en el frontend
    }

    // 3. Iniciar servidor con módulos habilitados
    const server = await startServer({
      port: APP_CONFIG.port,
      dbName: APP_CONFIG.dbName,
      enabledModules: license.modules,
      multiuser: APP_CONFIG.multiuser,
    })

    // 4. Cargar webapp
    win.loadURL(`http://localhost:${APP_CONFIG.port}`)

    // 5. Configurar auto-updater
    setupAutoUpdate({
      dbName: APP_CONFIG.dbName,
      currentVersion: app.getVersion(),
    })
  }
})
```

### 4.3 Frontend — ModuleGate en React

```tsx
// packages/react-components/src/ModuleGate.tsx
// Componente que oculta secciones de UI si el módulo no está habilitado

import { useModuleAccess } from '@enlocal/react-hooks'

interface Props {
  module: string         // 'mod-inventory', 'mod-invoicing', etc.
  children: React.ReactNode
  fallback?: React.ReactNode  // Opcional: mostrar "Addon no disponible"
}

export function ModuleGate({ module, children, fallback }: Props) {
  const { hasAccess, isAddon } = useModuleAccess(module)

  if (hasAccess) return <>{children}</>

  if (isAddon && fallback) {
    return <>{fallback}</>  // Mostrar upsell: "Activa este módulo..."
  }

  return null  // No mostrar nada
}

// Uso en la app:
// <ModuleGate module="mod-inventory">
//   <InventoryPage />
// </ModuleGate>
```

### 4.4 Middleware moduleGuard en Express

```typescript
// packages/core-server/src/middleware/moduleGuard.ts
// Bloquea requests a rutas de módulos no habilitados

export function moduleGuard(moduleName: string) {
  return (req, res, next) => {
    const enabledModules = req.app.get('enabledModules') as string[]
    
    if (!enabledModules.includes(moduleName)) {
      return res.status(403).json({
        error: 'MODULE_NOT_LICENSED',
        message: `El módulo ${moduleName} no está incluido en su licencia.`,
        addon: moduleName,
      })
    }
    
    next()
  }
}

// Uso al montar módulos:
export function mountInventoryRoutes(app, db) {
  app.use('/api/inventory', moduleGuard('mod-inventory'), inventoryRouter(db))
}
```

---

## 5. Sistema Multi-usuario con QR

```typescript
// packages/core-electron/src/qrAccess.ts
import QRCode from 'qrcode'
import os from 'os'

export function getLocalIP(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
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
  // Retorna data URL de la imagen QR
  return QRCode.toDataURL(url, { width: 300, margin: 2 })
}
```

Para apps multi-usuario (ERP, Servicios), la UI muestra un panel con el QR y la URL. Los otros dispositivos en la misma red escanean el QR y acceden a la webapp.

---

## 6. Auto-Actualizaciones

```typescript
// packages/core-updater/src/updater.ts
import { autoUpdater } from 'electron-updater'
import { dialog, Notification } from 'electron'

export function setupAutoUpdate(config: {
  dbName: string
  currentVersion: string
}) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  // Checa al inicio y cada 4 horas
  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: `Nueva versión ${info.version} disponible`,
      detail: 'Se respaldará tu base de datos antes de actualizar.',
      buttons: ['Actualizar ahora', 'Después'],
      defaultId: 0,
    })

    if (response === 0) {
      // 1. Backup de PostgreSQL
      await backupPostgres(config.dbName)
      // 2. Instalar
      autoUpdater.quitAndInstall()
    }
  })
}

async function backupPostgres(dbName: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `${dbName}-${timestamp}.sql`)
  
  await execAsync(`pg_dump ${dbName} > "${backupPath}"`)
  
  // Mantener solo últimos 5 backups
  cleanOldBackups(BACKUP_DIR, 5)
  
  return backupPath
}
```

---

## 7. Alertas de Vencimiento

```typescript
// packages/core-license/src/alerts.ts
import { Notification, BrowserWindow } from 'electron'

export function checkAndShowExpiryAlert(license: ValidationResult, win: BrowserWindow) {
  if (!license.showExpiryAlert) return

  const expiryDate = new Date(license.expiresAt).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  // Notificación nativa del OS
  new Notification({
    title: '⚠️ Licencia por vencer',
    body: `Tu licencia vence el ${expiryDate}. Renueva para no perder acceso.`,
  }).show()

  // También enviar al frontend vía IPC para banner in-app
  win.webContents.send('license:expiry-warning', {
    daysRemaining: license.daysRemaining,
    expiresAt: license.expiresAt,
  })
}
```

```tsx
// packages/react-components/src/LicenseAlert.tsx
export function LicenseAlert() {
  const [alert, setAlert] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.electronAPI?.onLicenseExpiryWarning((data) => {
      setAlert(data)
    })
  }, [])

  if (!alert || dismissed) return null

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 flex justify-between">
      <div>
        <p className="text-amber-800 font-medium">
          Tu licencia vence en {alert.daysRemaining} días
          ({new Date(alert.expiresAt).toLocaleDateString('es-MX')})
        </p>
        <p className="text-amber-700 text-sm">
          Renueva en todoenlocal.com para no perder acceso.
        </p>
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-600">
        Descartar
      </button>
    </div>
  )
}
```

---

## 8. Temas por App (UI Diferente)

Cada app tiene su propio tailwind.config.js con paleta de colores diferente:

```javascript
// apps/facturacion/webapp/tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff', 100: '#dbeafe', /* ... */ 600: '#2563eb', /* azul */
        }
      }
    }
  }
}

// apps/caja/webapp/tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4', 100: '#dcfce7', /* ... */ 600: '#16a34a', /* verde */
        }
      }
    }
  }
}

// apps/erp/webapp/tailwind.config.js → púrpura
// apps/nominas/webapp/tailwind.config.js → cyan
// apps/servicios/webapp/tailwind.config.js → naranja
```

Así usan las mismas clases (`bg-primary-600`, `text-primary-100`) pero cada app se ve diferente.

---

## 9. Configuración por App

Cada app define un archivo de configuración con sus módulos, puerto y características:

```typescript
// apps/facturacion/app.config.ts
export default {
  appId: 'enlocal-facturacion',
  appName: 'enLocal Facturación',
  electronAppId: 'com.todoenlocal.facturacion',
  port: 9001,
  dbName: 'enlocal_facturacion',
  multiuser: false,
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://updates.todoenlocal.com/facturacion',
  icon: './assets/icon.png',
  color: '#2563eb',
  modules: {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-reports'],
    addons: ['mod-inventory', 'mod-pos'],
  }
}

// apps/erp/app.config.ts
export default {
  appId: 'enlocal-erp',
  appName: 'enLocal ERP',
  electronAppId: 'com.todoenlocal.erp',
  port: 9003,
  dbName: 'enlocal_erp',
  multiuser: true,        // ← Genera QR, escucha en 0.0.0.0
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://updates.todoenlocal.com/erp',
  icon: './assets/icon.png',
  color: '#7c3aed',
  modules: {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-inventory',
              'mod-pos', 'mod-payroll', 'mod-reports'],
    addons: ['mod-appointments'],
  }
}
```

---

## 10. Modelo de Datos en la Nube (TodoEnLocal.com)

### Tablas del sistema de licencias en el backend FastAPI

```sql
-- Softwares disponibles en la suite
CREATE TABLE suite_softwares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(50) UNIQUE NOT NULL,     -- 'enlocal-facturacion'
  name VARCHAR(100) NOT NULL,             -- 'enLocal Facturación'
  description TEXT,
  default_modules JSONB NOT NULL,         -- ['mod-config', 'mod-catalogs', ...]
  available_addons JSONB NOT NULL,        -- ['mod-inventory', 'mod-pos']
  latest_version VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Licencias emitidas
CREATE TABLE suite_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_key VARCHAR(50) UNIQUE NOT NULL,  -- 'TEL-XXXXX-XXXXX-XXXXX'
  business_id UUID REFERENCES businesses(id),
  software_id UUID REFERENCES suite_softwares(id),
  plan VARCHAR(20) NOT NULL,               -- 'basic', 'pro', 'enterprise'
  status VARCHAR(20) DEFAULT 'active',     -- active, expired, revoked, suspended
  addons JSONB DEFAULT '[]',               -- Módulos addon comprados
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  months_purchased INTEGER NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Instalaciones (1 licencia puede tener N instalaciones según plan)
CREATE TABLE suite_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES suite_licenses(id),
  installation_hash VARCHAR(64) UNIQUE NOT NULL, -- Hash generado al activar
  fingerprint VARCHAR(64) NOT NULL,              -- Hardware fingerprint
  hardware_details JSONB,                        -- CPU, MAC, disco, etc.
  app_id VARCHAR(50) NOT NULL,
  branch_id UUID,
  terminal_id UUID,
  app_version VARCHAR(20),
  last_validation TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(20) DEFAULT 'active',           -- active, revoked
  activated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de validaciones
CREATE TABLE suite_license_validations (
  id BIGSERIAL PRIMARY KEY,
  installation_id UUID REFERENCES suite_installations(id),
  result VARCHAR(20) NOT NULL,  -- valid, expired, revoked, hardware_mismatch
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
