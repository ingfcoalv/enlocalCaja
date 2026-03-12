# Implementar Sistema de Trial 15 dias en enLocal Comanda Pro

## Contexto del proyecto

enLocal Comanda Pro es una app Electron + Express + React para restaurantes. Es un proyecto standalone (NO monorepo, NO TypeScript — todo es JavaScript/JSX).

**Estructura actual:**
```
comanda-pro/
├── electron/
│   ├── main.js                        ← Electron main process
│   ├── preload.js                     ← Context bridge
│   ├── auth/
│   │   ├── license.js                 ← activateLicense(), validateLicense()
│   │   ├── fingerprint.js             ← generateFingerprint(), getHardwareDetails()
│   │   ├── token-store.js             ← get/setTerminalToken(), get/setLicenseInfo()
│   │   └── session.js                 ← PIN login
│   ├── config/
│   │   ├── store.js                   ← Conf (electron-store), getConfig/setConfig
│   │   └── defaults.js                ← CONFIG_DEFAULTS
│   ├── server/
│   │   ├── index.js                   ← Express server (port 8585)
│   │   ├── api/routes/
│   │   │   ├── license.js             ← GET /api/license
│   │   │   ├── sync.js                ← GET /api/sync/status, POST /api/sync/trigger
│   │   │   ├── auth.js, products.js, orders.js, etc.
│   │   └── backup/
│   ├── sync/
│   │   └── sync-engine.js             ← initSync(), runSync(), getSyncStatus()
│   └── database/
│       ├── pg-server.js               ← Embedded PostgreSQL (port 5434)
│       └── connection.js, migrate.js, seed.js
├── src/                               ← Electron renderer (dashboard)
│   ├── App.jsx                        ← Decide: ActivationPage o ServerDashboard
│   └── pages/
│       ├── ActivationPage.jsx         ← Form para activar licencia
│       └── ServerDashboard.jsx        ← Panel del servidor (QR, devices, etc.)
├── webapp/                            ← React POS (se sirve en /pos)
│   └── src/
│       ├── App.jsx                    ← Router con rutas /pos/*
│       ├── components/Layout.jsx      ← Navbar + OfflineIndicator + children
│       └── pages/                     ← TablesPage, OrderPage, KitchenPage, AdminPage...
└── package.json
```

**Config actual (`electron/config/defaults.js`):**
```js
{
  port: 8585,
  cloudApiUrl: 'https://todoenlocal.com',
  pgPort: 5434,
  pgDatabase: 'enlocal_comanda',
  licenseStatus: 'inactive', // inactive | active | expired
  terminalToken: null,
  licenseKey: null,
  // ... etc
}
```

**Flujo actual de arranque (`electron/main.js`):**
1. `app.whenReady()` → `setupIPC()` + `createWindow()` + `createTray()` + `validateAndStart()`
2. `validateAndStart()` → `validateLicense()` → si valida → `initServer()` + `initSync()`
3. Si NO valida → manda `license-status: { status: 'inactive' }` al renderer
4. El renderer (`src/App.jsx`) muestra `ActivationPage` si status != 'active', o `ServerDashboard` si activa

**Sistema de licencia actual (`electron/auth/license.js`):**
- `activateLicense(serial)` — POST a `/api/v1/licenses/activate`
- `validateLicense()` — POST a `/api/v1/licenses/validate` con terminal_token y fingerprint
- Si falla por red → `checkOfflineGracePeriod()` (7 dias de gracia)
- Guarda todo en `Conf` via `token-store.js`

**Preload actual (`electron/preload.js`):**
- `activateLicense(serial)` → `ipcRenderer.invoke('activate-license', serial)`
- `getLicenseInfo()` → `ipcRenderer.invoke('get-license-info')`
- `onLicenseStatus(callback)` → `ipcRenderer.on('license-status', ...)`
- NO tiene `invoke()` generico — cada funcion es explicita

---

## Reglas de negocio del trial

- **Trial completo**: todas las funciones habilitadas, sin restricciones
- **Sin sincronizacion en trial**: SyncEngine no arranca, sync routes retornan `status: 'disabled'`
- **Login local en trial**: PIN login ya funciona contra DB local. No hay cambio necesario
- **Trial por producto**: independiente entre apps (codigo de producto: `enlocal_comanda`)
- **Reinstalar = recuperar trial**: cloud retorna trial existente con dias restantes
- **3 dias de gracia offline** si no hay internet en el primer lanzamiento
- **Datos se conservan**: al activar licencia post-trial, la DB local persiste tal cual
- **1 terminal** durante trial
- **Chequeo periodico**: cada hora verificar si el trial expiro y cerrar POS window

---

## Cloud API del Trial

**`POST https://todoenlocal.com/api/v1/pos/desktop/trial`**

Request:
```json
{
  "hardware_fingerprint": "sha256...",
  "hardware_details": { "hostname", "os_version", "cpu_id", "mac_address", "disk_serial" },
  "product_code": "enlocal_comanda",
  "pos_version": "1.3.0"
}
```

Response 200 (trial nuevo o existente):
```json
{
  "message": "Trial registrado exitosamente",
  "trial": { "id", "hardware_fingerprint", "product_code", "started_at", "ends_at", "status": "active" },
  "terminal_token": "tt_trial_xxx"
}
```

Response 409 (trial ya expirado):
```json
{
  "message": "Este equipo ya utilizó el periodo de prueba para este producto.",
  "trial": { "id", "started_at", "ends_at", "status": "expired" }
}
```

---

## Archivos a MODIFICAR

### 1. `electron/config/defaults.js` — Agregar campos trial

Agregar estos campos nuevos al objeto `CONFIG_DEFAULTS`:

```js
  // Trial fields
  trialStartedAt: null,
  trialEndsAt: null,
  trialRegistered: false,
  offlineTrialStartedAt: null,
```

---

### 2. `electron/auth/license.js` — Agregar funciones de trial

Agregar al final del archivo estas 3 funciones exportadas:

```js
const TRIAL_DAYS = 15;
const OFFLINE_GRACE_DAYS = 3;

export async function registerTrial() {
  const cloudUrl = getConfig('cloudApiUrl');
  const fingerprint = generateFingerprint();
  const hardwareDetails = getHardwareDetails();

  let posVersion = '1.0.0';
  try {
    const { app } = await import('electron');
    posVersion = app?.getVersion?.() || '1.0.0';
  } catch {}

  const response = await axios.post(`${cloudUrl}/api/v1/pos/desktop/trial`, {
    hardware_fingerprint: fingerprint,
    hardware_details: hardwareDetails,
    product_code: 'enlocal_comanda',
    pos_version: posVersion,
  }, { timeout: 15000 });

  // 200 = trial activo (nuevo o existente)
  const { trial, terminal_token } = response.data;

  setTerminalToken(terminal_token);
  setLicenseInfo({
    key: null,
    status: 'trial',
    plan: 'trial',
    expiresAt: trial.ends_at,
  });
  setConfig('trialStartedAt', trial.started_at);
  setConfig('trialEndsAt', trial.ends_at);
  setConfig('trialRegistered', true);
  setConfig('licenseLastCloudValidation', new Date().toISOString());

  return { success: true, trialEndsAt: trial.ends_at, terminalToken: terminal_token };
}

export function startOfflineTrial() {
  // Check if trial already exists
  const existing = getConfig('trialStartedAt');
  if (existing) {
    return { success: false, message: 'El periodo de prueba ya fue iniciado.' };
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  setLicenseInfo({
    key: null,
    status: 'trial',
    plan: 'trial',
    expiresAt: endsAt.toISOString(),
  });
  setConfig('trialStartedAt', now.toISOString());
  setConfig('trialEndsAt', endsAt.toISOString());
  setConfig('trialRegistered', false);
  setConfig('offlineTrialStartedAt', now.toISOString());

  return { success: true, trialEndsAt: endsAt.toISOString() };
}

export function getTrialStatus() {
  const trialStartedAt = getConfig('trialStartedAt');
  const trialEndsAt = getConfig('trialEndsAt');
  const trialRegistered = getConfig('trialRegistered') || false;
  const offlineTrialStartedAt = getConfig('offlineTrialStartedAt');
  const licenseStatus = getConfig('licenseStatus');

  // Not a trial
  if (!trialStartedAt || (licenseStatus !== 'trial' && licenseStatus !== 'trial_expired')) {
    return {
      isTrial: false,
      isRegistered: false,
      trialEndsAt: null,
      daysRemaining: 0,
      offlineGraceExpired: false,
      isExpired: false,
    };
  }

  const now = new Date();
  const endsAt = new Date(trialEndsAt);
  const daysRemaining = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isExpired = daysRemaining <= 0;

  // Check offline grace (3 days from offline trial start)
  let offlineGraceExpired = false;
  if (!trialRegistered && offlineTrialStartedAt) {
    const graceDays = (now.getTime() - new Date(offlineTrialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
    offlineGraceExpired = graceDays > OFFLINE_GRACE_DAYS;
  }

  if (isExpired) {
    setLicenseInfo({ status: 'trial_expired' });
  }

  return {
    isTrial: true,
    isRegistered: trialRegistered,
    trialEndsAt,
    daysRemaining,
    offlineGraceExpired,
    isExpired,
  };
}
```

Tambien agregar `'trial' | 'trial_expired'` como estados validos. En `validateLicense()`, agregar al inicio (despues de obtener `info` y `token`):

```js
  // If this is a trial, delegate to trial flow
  if (info.status === 'trial') {
    const trialStatus = getTrialStatus();
    if (trialStatus.isExpired) {
      return { valid: false, reason: 'Periodo de prueba finalizado' };
    }
    if (trialStatus.offlineGraceExpired) {
      return { valid: false, reason: 'Se necesita conexion a internet para completar el registro del periodo de prueba' };
    }
    return { valid: true, ...info, isTrial: true, trialStatus };
  }

  if (info.status === 'trial_expired') {
    return { valid: false, reason: 'Periodo de prueba finalizado' };
  }
```

---

### 3. `electron/auth/token-store.js` — Agregar trial info a getLicenseInfo

Modificar `getLicenseInfo()` para incluir campos de trial:

```js
export function getLicenseInfo() {
  return {
    key: getConfig('licenseKey'),
    status: getConfig('licenseStatus'),
    plan: getConfig('licensePlan'),
    expiresAt: getConfig('licenseExpiresAt'),
    trialStartedAt: getConfig('trialStartedAt'),
    trialEndsAt: getConfig('trialEndsAt'),
    trialRegistered: getConfig('trialRegistered'),
    isTrial: getConfig('licenseStatus') === 'trial',
  };
}
```

---

### 4. `electron/main.js` — Flujo principal con trial

**Agregar imports:**

```js
import { activateLicense, validateLicense, registerTrial, startOfflineTrial, getTrialStatus } from './auth/license.js';
```

**Agregar variable de estado:**

```js
let trialCheckInterval = null;
```

**Reemplazar `validateAndStart()` completo:**

```js
async function validateAndStart() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-status', { status: 'validating_license' });
  }

  // Check trial status first
  const trialStatus = getTrialStatus();

  if (trialStatus.isTrial) {
    if (trialStatus.isExpired) {
      sendLicenseStatus({ status: 'trial_expired', reason: 'Periodo de prueba finalizado' });
      updateTrayIcon('yellow');
      return;
    }

    if (trialStatus.offlineGraceExpired) {
      sendLicenseStatus({ status: 'trial_offline_expired', reason: 'Se necesita conexion a internet para completar el registro' });
      updateTrayIcon('yellow');
      return;
    }

    // Try to register if not yet registered
    if (!trialStatus.isRegistered) {
      try {
        await registerTrial();
      } catch (err) {
        // Network error — continue in offline grace
        console.log('[Trial] Cloud registration failed, continuing in grace:', err.message);
      }
    }

    // Trial is active — start server
    sendLicenseStatus({
      status: 'trial',
      plan: 'trial',
      isTrial: true,
      trialEndsAt: trialStatus.trialEndsAt,
      daysRemaining: trialStatus.daysRemaining,
    });
    await initServer();

    // Do NOT init sync during trial
    // Start periodic trial check
    startTrialCheck();
    return;
  }

  // Normal license validation
  const result = await validateLicense();

  if (result.valid) {
    // If validateLicense returned isTrial, it's a trial via the validator
    if (result.isTrial) {
      sendLicenseStatus({
        status: 'trial',
        plan: 'trial',
        isTrial: true,
        trialEndsAt: result.trialStatus?.trialEndsAt,
        daysRemaining: result.trialStatus?.daysRemaining,
      });
      await initServer();
      startTrialCheck();
      return;
    }

    sendLicenseStatus({
      status: 'active',
      plan: result.plan,
      expiresAt: result.expiresAt,
      cloudValidated: result.cloudValidated,
      offlineDaysRemaining: result.offlineDaysRemaining,
    });
    await initServer();

    // Init sync only for licensed (not trial) users
    try {
      const { initSync } = await import('./sync/sync-engine.js');
      const io = serverInfo?.io || null;
      await initSync(io, (event, data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-event', { event, data });
        }
      });
    } catch (err) {
      console.error('Failed to start sync:', err);
    }
  } else {
    sendLicenseStatus({
      status: result.reason?.includes('prueba') ? 'trial_expired' : (result.reason?.includes('conexion') ? 'trial_offline_expired' : (result.reason?.includes('expirad') ? 'expired' : 'inactive')),
      reason: result.reason,
    });
    updateTrayIcon('yellow');
    updateTrayMenu();
  }
}

function startTrialCheck() {
  if (trialCheckInterval) return;
  trialCheckInterval = setInterval(() => {
    const status = getTrialStatus();
    if (status.isExpired) {
      console.log('[Trial] Expired at runtime');
      clearInterval(trialCheckInterval);
      trialCheckInterval = null;
      sendLicenseStatus({ status: 'trial_expired', reason: 'Periodo de prueba finalizado' });
      // Notify webapp via server status to trigger reload
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-status', { status: 'trial_expired' });
      }
    } else {
      // Update trial badge
      sendLicenseStatus({
        status: 'trial',
        plan: 'trial',
        isTrial: true,
        trialEndsAt: status.trialEndsAt,
        daysRemaining: status.daysRemaining,
      });
    }
  }, 60 * 60 * 1000); // Every hour
}
```

**Agregar nuevos IPC handlers en `setupIPC()`:**

```js
  ipcMain.handle('start-trial', async () => {
    try {
      // Try cloud registration first
      try {
        const result = await registerTrial();
        if (!result.success) {
          return { success: false, error: result.message || 'El periodo de prueba ya fue utilizado.' };
        }
      } catch (netErr) {
        // Network error — fallback to offline trial
        console.log('[Trial] Cloud unreachable, starting offline:', netErr.message);
        const offlineResult = startOfflineTrial();
        if (!offlineResult.success) {
          return { success: false, error: offlineResult.message || 'El periodo de prueba ya fue utilizado.' };
        }
      }

      // Start server
      await validateAndStart();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-trial-status', () => {
    return getTrialStatus();
  });

  ipcMain.handle('activate-license-from-trial', async (event, serial) => {
    try {
      const result = await activateLicense(serial);
      sendLicenseStatus({
        status: 'active',
        plan: result.plan,
        expiresAt: result.expiresAt,
      });
      // Clear trial check
      if (trialCheckInterval) {
        clearInterval(trialCheckInterval);
        trialCheckInterval = null;
      }
      return { success: true, message: 'Licencia activada exitosamente. Reinicia la aplicacion para aplicar los cambios.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
```

---

### 5. `electron/preload.js` — Exponer nuevos handlers

Agregar al objeto `electronAPI`:

```js
  // Trial
  startTrial: () => ipcRenderer.invoke('start-trial'),
  getTrialStatus: () => ipcRenderer.invoke('get-trial-status'),
  activateLicenseFromTrial: (serial) => ipcRenderer.invoke('activate-license-from-trial', serial),
```

---

### 6. `electron/server/api/routes/license.js` — Agregar trial info

Agregar import de `getTrialStatus`:

```js
import { getTrialStatus } from '../../../auth/license.js';
```

Modificar el handler `GET /api/license` para incluir trial:

```js
router.get('/', authMiddleware, requirePermission('settings.read'), (req, res) => {
  const info = getLicenseInfo();
  const lastValidation = getConfig('licenseLastCloudValidation');
  const hasToken = !!getTerminalToken();
  const trialStatus = getTrialStatus();

  res.json({
    status: trialStatus.isTrial ? 'trial' : info.status,
    plan: trialStatus.isTrial ? 'trial' : info.plan,
    expiresAt: trialStatus.isTrial ? trialStatus.trialEndsAt : info.expiresAt,
    lastCloudValidation: lastValidation,
    isLinked: hasToken,
    serialHint: info.key
      ? info.key.slice(0, 7) + '***' + info.key.slice(-5)
      : null,
    isTrial: trialStatus.isTrial,
    trial: trialStatus.isTrial ? {
      trialStartedAt: info.trialStartedAt,
      trialEndsAt: trialStatus.trialEndsAt,
      trialRegistered: info.trialRegistered,
      daysRemaining: trialStatus.daysRemaining,
    } : null,
  });
});
```

Agregar endpoint publico para trial status (sin auth):

```js
// GET /api/license/trial-status — public (used by webapp)
router.get('/trial-status', (req, res) => {
  try {
    const { getTrialStatus } = require('../../../auth/license.js');
    res.json(getTrialStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

NOTA: Usar import estatico si el archivo ya usa ESM, o dynamic import si es necesario. Adaptar segun el estilo del archivo.

---

### 7. `electron/server/api/routes/sync.js` — Bloquear sync en trial

Agregar al INICIO de los handlers `GET /status` y `POST /trigger`:

```js
import { getTrialStatus } from '../../../auth/license.js';
```

En `GET /status`:
```js
router.get('/status', authMiddleware, requirePermission('settings.read'), async (req, res) => {
  const trialStatus = getTrialStatus();
  if (trialStatus.isTrial) {
    return res.json({
      enabled: false,
      status: 'disabled',
      lastPull: null,
      lastPush: null,
      isTrial: true,
      message: 'Sincronizacion no disponible durante el periodo de prueba',
    });
  }
  // ... resto existente ...
});
```

En `POST /trigger`:
```js
router.post('/trigger', authMiddleware, requirePermission('settings.update'), async (req, res) => {
  const trialStatus = getTrialStatus();
  if (trialStatus.isTrial) {
    return res.status(403).json({
      error: 'TRIAL_MODE',
      message: 'Sincronizacion no disponible durante el periodo de prueba',
    });
  }
  // ... resto existente ...
});
```

---

### 8. `src/App.jsx` — Dashboard renderer: agregar pantalla Welcome

El `src/App.jsx` actual muestra `ActivationPage` o `ServerDashboard`. Modificar para manejar 3 estados nuevos: `trial`, `trial_expired`, `trial_offline_expired`, y un estado `welcome` para primera vez.

**Reemplazar `src/App.jsx`:**

```jsx
import React, { useState, useEffect } from 'react';
import ServerDashboard from './pages/ServerDashboard';
import ActivationPage from './pages/ActivationPage';
import WelcomePage from './pages/WelcomePage';
import TrialExpiredPage from './pages/TrialExpiredPage';

export default function App() {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLicense();

    if (window.electronAPI?.onLicenseStatus) {
      window.electronAPI.onLicenseStatus((data) => {
        setLicenseInfo(data);
      });
    }

    return () => {
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners('license-status');
      }
    };
  }, []);

  async function checkLicense() {
    try {
      if (window.electronAPI) {
        const info = await window.electronAPI.getLicenseInfo();
        setLicenseInfo(info);
      } else {
        setLicenseInfo({ status: 'active' });
      }
    } catch {
      setLicenseInfo(null);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  // Trial expired
  if (licenseInfo?.status === 'trial_expired') {
    return <TrialExpiredPage onActivated={checkLicense} />;
  }

  // Trial offline expired (needs internet)
  if (licenseInfo?.status === 'trial_offline_expired') {
    return <TrialExpiredPage onActivated={checkLicense} offline />;
  }

  // Active trial or active license → dashboard
  if (licenseInfo?.status === 'active' || licenseInfo?.status === 'trial') {
    return <ServerDashboard licenseInfo={licenseInfo} />;
  }

  // No license — first time → Welcome (trial + activation options)
  if (!licenseInfo || licenseInfo.status === 'inactive') {
    return <WelcomePage onActivated={checkLicense} />;
  }

  // Expired license
  if (licenseInfo.status === 'expired') {
    return <ActivationPage onActivated={checkLicense} reason={licenseInfo.reason} />;
  }

  // Fallback
  return <ActivationPage onActivated={checkLicense} reason={licenseInfo?.reason} />;
}
```

---

### 9. `src/pages/WelcomePage.jsx` — CREAR NUEVO

Pantalla de bienvenida con 2 opciones: iniciar trial o activar licencia.

```jsx
import React, { useState } from 'react';
import ActivationPage from './ActivationPage';

export default function WelcomePage({ onActivated }) {
  const [showActivation, setShowActivation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (showActivation) {
    return <ActivationPage onActivated={onActivated} />;
  }

  async function handleStartTrial() {
    setLoading(true);
    setError(null);

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.startTrial();
        if (result.success) {
          onActivated();
        } else {
          setError(result.error || 'Error al iniciar periodo de prueba');
        }
      }
    } catch (err) {
      setError(err.message || 'Error de conexion');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">enLocal Comanda Pro</h1>
          <p className="text-sm text-gray-400 mt-1">Elige como quieres comenzar</p>
        </div>

        {/* Trial option */}
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-60 text-white rounded-xl p-5 text-left transition group"
        >
          <div className="text-2xl mb-2">🚀</div>
          <div className="font-bold text-base">Iniciar Prueba Gratuita</div>
          <div className="text-xs text-blue-200 mt-1">
            15 dias con todas las funciones habilitadas, sin compromiso.
          </div>
          {loading && (
            <div className="text-xs text-blue-300 mt-2">Iniciando...</div>
          )}
        </button>

        <div className="text-center text-xs text-gray-500">o</div>

        {/* License option */}
        <button
          onClick={() => setShowActivation(true)}
          className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-xl p-5 text-left transition"
        >
          <div className="text-2xl mb-2">🔑</div>
          <div className="font-bold text-base">Tengo una Licencia</div>
          <div className="text-xs text-gray-400 mt-1">
            Ingresa tu clave de licencia comprada en todoenlocal.com
          </div>
        </button>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 10. `src/pages/TrialExpiredPage.jsx` — CREAR NUEVO

Pantalla cuando el trial expira o la gracia offline vence.

```jsx
import React, { useState } from 'react';

export default function TrialExpiredPage({ onActivated, offline = false }) {
  const [serial, setSerial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function formatSerial(value) {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 8) return clean.slice(0, 3) + '-' + clean.slice(3);
    if (clean.length <= 13) return clean.slice(0, 3) + '-' + clean.slice(3, 8) + '-' + clean.slice(8);
    return clean.slice(0, 3) + '-' + clean.slice(3, 8) + '-' + clean.slice(8, 13) + '-' + clean.slice(13, 18);
  }

  async function handleActivate(e) {
    e.preventDefault();
    if (!serial.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.activateLicense(serial.trim());
        if (result.success) {
          onActivated();
        } else {
          setError(result.error || 'Error al activar licencia');
        }
      }
    } catch (err) {
      setError(err.message || 'Error de conexion');
    }
    setLoading(false);
  }

  async function handleRetry() {
    onActivated();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">{offline ? '🌐' : '⏰'}</div>
          <h1 className="text-xl font-bold">
            {offline ? 'Conexion requerida' : 'Periodo de prueba finalizado'}
          </h1>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            {offline
              ? 'Se necesita conexion a internet para completar el registro del periodo de prueba. Conectate a internet y presiona Reintentar.'
              : 'Los 15 dias de prueba gratuita han terminado. Tus datos se conservan y estaran disponibles al activar tu licencia.'
            }
          </p>
        </div>

        {offline ? (
          <button
            onClick={handleRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition text-sm font-medium"
          >
            Reintentar
          </button>
        ) : (
          <>
            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Serial de licencia
                </label>
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => setSerial(formatSerial(e.target.value))}
                  placeholder="TEL-XXXXX-XXXXX-XXXXX"
                  maxLength={21}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 uppercase font-mono tracking-wider"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !serial.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded-lg transition text-sm font-medium"
              >
                {loading ? 'Activando...' : 'Activar licencia'}
              </button>
            </form>

            <p className="text-xs text-gray-600 text-center">
              Compra tu licencia en{' '}
              <a href="https://todoenlocal.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                todoenlocal.com
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

---

### 11. `src/pages/ServerDashboard.jsx` — Agregar badge de trial

Modificar para recibir `licenseInfo` como prop y mostrar badge de trial.

Agregar prop `licenseInfo`:

```jsx
export default function ServerDashboard({ licenseInfo: initialLicenseInfo }) {
```

En el state:
```jsx
  const [licenseInfo, setLicenseInfo] = useState(initialLicenseInfo || null);
```

Agregar despues del header (antes del License Info card):

```jsx
        {/* Trial Badge */}
        {licenseInfo?.isTrial && (
          <div className={`rounded-lg p-3 text-center text-sm font-medium ${
            (licenseInfo.daysRemaining ?? 99) <= 3
              ? 'bg-red-900/50 border border-red-700 text-red-300'
              : 'bg-yellow-900/50 border border-yellow-700 text-yellow-300'
          }`}>
            Periodo de prueba: {licenseInfo.daysRemaining ?? '--'} dia{(licenseInfo.daysRemaining ?? 0) !== 1 ? 's' : ''} restante{(licenseInfo.daysRemaining ?? 0) !== 1 ? 's' : ''}
          </div>
        )}
```

Modificar el bloque de License Info para manejar trial:

```jsx
        {/* License Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">
            {licenseInfo?.isTrial ? 'Periodo de prueba' : 'Licencia'}
          </h2>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Serial</span>
              <span className="font-mono">
                {licenseInfo?.isTrial ? 'Prueba gratuita' : maskSerial(licenseInfo?.key)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tipo</span>
              <span className="capitalize">
                {licenseInfo?.isTrial ? 'Completo (prueba)' : (licenseInfo?.plan || 'N/A')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Vigencia</span>
              <span>
                {licenseInfo?.isTrial
                  ? (licenseInfo.trialEndsAt ? new Date(licenseInfo.trialEndsAt).toLocaleDateString() : '--')
                  : (licenseInfo?.expiresAt ? new Date(licenseInfo.expiresAt).toLocaleDateString() : 'Perpetua')
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sincronizacion</span>
              <span className={licenseInfo?.isTrial ? 'text-gray-500' : 'text-green-400'}>
                {licenseInfo?.isTrial ? 'No disponible en prueba' : 'Habilitada'}
              </span>
            </div>
          </div>
        </div>
```

Agregar al final (antes del cierre del div principal), un CTA de trial:

```jsx
        {/* Trial CTA */}
        {licenseInfo?.isTrial && (
          <p className="text-xs text-gray-500 text-center">
            Activa tu licencia para uso permanente en{' '}
            <a href="https://todoenlocal.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              todoenlocal.com
            </a>
          </p>
        )}
```

---

### 12. `webapp/src/components/Layout.jsx` — Banner de trial en el POS

Agregar un banner de trial visible en todas las paginas del POS:

```jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import OfflineIndicator from './OfflineIndicator';

const HIDE_WATERMARK = ['/pos/kitchen', '/pos/admin', '/pos/online-orders'];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const showWatermark = !HIDE_WATERMARK.some((p) => pathname.startsWith(p));
  const [trialInfo, setTrialInfo] = useState(null);

  useEffect(() => {
    // Fetch trial status from API
    fetch('/api/license/trial-status')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.isTrial) setTrialInfo(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface-100 overflow-hidden">
      <Navbar />
      <OfflineIndicator />

      {/* Trial banner */}
      {trialInfo && (
        <div className={`px-4 py-2 text-xs font-medium flex items-center justify-between ${
          trialInfo.daysRemaining <= 3
            ? 'bg-red-50 text-red-800 border-b border-red-200'
            : 'bg-amber-50 text-amber-800 border-b border-amber-200'
        }`}>
          <span>
            Periodo de prueba: <strong>{trialInfo.daysRemaining} dia{trialInfo.daysRemaining !== 1 ? 's' : ''}</strong> restante{trialInfo.daysRemaining !== 1 ? 's' : ''}
          </span>
          <a
            href="https://todoenlocal.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              trialInfo.daysRemaining <= 3
                ? 'bg-red-100 text-red-900 hover:bg-red-200'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
            }`}
          >
            Comprar licencia
          </a>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {showWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{ paddingTop: '20%' }}>
            <span className="text-[6rem] md:text-[8rem] font-extrabold text-primary-300/20 select-none whitespace-nowrap tracking-tight leading-none text-center">
              enLocal<br />Comanda Pro
            </span>
          </div>
        )}
        <div className="relative z-10 flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---

## Orden de implementacion

1. **Lee todos los archivos** que vas a modificar primero
2. `electron/config/defaults.js` — Campos trial nuevos
3. `electron/auth/license.js` — Funciones registerTrial, startOfflineTrial, getTrialStatus + modificar validateLicense
4. `electron/auth/token-store.js` — Trial info en getLicenseInfo
5. `electron/main.js` — Imports, validateAndStart con trial, IPC handlers nuevos
6. `electron/preload.js` — Exponer startTrial, getTrialStatus, activateLicenseFromTrial
7. `electron/server/api/routes/license.js` — Trial info en GET /api/license + endpoint /trial-status
8. `electron/server/api/routes/sync.js` — Bloquear sync en trial
9. `src/App.jsx` — Manejar estados trial/trial_expired/trial_offline_expired
10. `src/pages/WelcomePage.jsx` — CREAR (bienvenida con trial + activacion)
11. `src/pages/TrialExpiredPage.jsx` — CREAR (trial expirado / offline expirado)
12. `src/pages/ServerDashboard.jsx` — Badge trial, info trial, CTA
13. `webapp/src/components/Layout.jsx` — Banner trial en el POS

## Notas importantes

- **Todo es JavaScript** (NO TypeScript). No uses tipos, interfaces, ni `.ts`/`.tsx`.
- **NO hay paquetes compartidos** (`@enlocal/core-license`, etc.). Todo se implementa directamente en los archivos del proyecto.
- **Config usa `Conf`** (electron-store). Los valores se guardan/leen con `getConfig(key)` / `setConfig(key, value)`.
- **El preload NO tiene `invoke()` generico** — cada funcion es explicita (e.g. `startTrial()`, no `invoke('start-trial')`).
- **La webapp POS** se sirve en `/pos/*`, no en root.
- **El renderer dashboard** esta en `src/`, no en `webapp/`.
- **No hay modulos** (`mod-config`, etc.) — todo esta integrado. No hay concepto de "habilitar modulos" en trial.
- **Product code**: `enlocal_comanda` (para el API del cloud)

## Build despues de implementar

```bash
# Build renderer dashboard (Electron window)
cd comanda-pro && npm run build   # o: npx vite build

# Build webapp POS
cd comanda-pro/webapp && npm run build   # o: npx vite build
```

## Verificacion

- [ ] Primera apertura sin licencia → muestra WelcomePage con 2 opciones
- [ ] Click "Iniciar Prueba" con internet → registra trial en cloud → ServerDashboard con badge trial
- [ ] Click "Iniciar Prueba" sin internet → crea trial offline → ServerDashboard con badge trial
- [ ] Dia 4 sin internet (trial offline no registrado) → muestra TrialExpiredPage offline → pide conexion
- [ ] Trial activo → banner amarillo en webapp POS con countdown
- [ ] Trial activo → login local con PIN funciona
- [ ] Trial activo → sync devuelve disabled/TRIAL_MODE
- [ ] Dia 16 → muestra TrialExpiredPage con form de activacion
- [ ] Activar licencia desde TrialExpiredPage → funciona, datos se conservan
- [ ] Licencia activa → sin banner trial, sync habilitada
