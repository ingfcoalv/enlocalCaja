# Implementar sistema de Backups en Comanda Pro

## Contexto

Comanda Pro (`apps/comanda-pro`) es un producto independiente de Caja. Ambos comparten la misma arquitectura de monorepo pero **nunca comparten base de datos**. Cada uno tiene su propia instancia de PostgreSQL embebida.

**Puertos de Comanda Pro:**
- PostgreSQL: `5434`
- Server Express: `9006`
- DB name: `enlocal_comanda`
- User/Password PG: `enlocal` / `enlocal`

## Objetivo

Replicar el sistema de backups de `apps/caja` adaptado para Comanda Pro. El sistema tiene 4 archivos backend + integración en main.ts + integración en server/index.ts.

---

## Archivos a crear

### 1. `apps/comanda-pro/electron/server/backup/smartBackupService.ts`

Copiar de `apps/caja/electron/server/backup/smartBackupService.ts` y hacer estos cambios:

| Buscar | Reemplazar por |
|--------|---------------|
| `'enLocal Caja'` | `'enLocal Comanda'` |
| `'enlocal_caja'` | `'enlocal_comanda'` |
| `enlocal_caja_` (en nombres de archivo/filtros) | `enlocal_comanda_` |
| `'enLocal Caja', 'Respaldos'` (path de Google Drive) | `'enLocal Comanda', 'Respaldos'` |
| `path.join(os.homedir(), 'Documents', 'enLocal Caja', 'Respaldos')` | `path.join(os.homedir(), 'Documents', 'enLocal Comanda', 'Respaldos')` |

**Mantener exactamente igual:**
- Toda la lógica de `discoverSchema()`, `createBackup()`, `restoreBackup()`
- Formato de backup: `enlocal-smart-backup` con `formatVersion: 2`
- Compresión gzip nivel 9
- Rotación: `todayMax: 3`, `dailyDays: 7`, `sparseInterval: 3`, `sparseDays: 30`, `monthlyCount: 2`
- Lotes de inserción de 500 rows
- State path: `~/AppData/Roaming/enLocal/comanda-backup-state.json` (IMPORTANTE: cambiar el nombre del state file para que no choque con Caja)
- Tablas excluidas: `pg_stat_statements`, `schema_migrations`, `knex_migrations`, `knex_migrations_lock`, `_prisma_migrations`

**Nombre de archivo de backups:**
```
enlocal_comanda_{YYYY-MM-DD}_{HH-mm-ss}_v{version}_{tipo}.enlocal-backup
```

**El `listBackups()` debe filtrar por `enlocal_comanda_` en vez de `enlocal_caja_`.**

---

### 2. `apps/comanda-pro/electron/server/backup/fullDumpService.ts`

Copiar de `apps/caja/electron/server/backup/fullDumpService.ts` y hacer estos cambios:

| Buscar | Reemplazar por |
|--------|---------------|
| `'enlocal_caja'` | `'enlocal_comanda'` |
| `5433` (default port) | `5434` |
| `'enLocal Caja'` | `'enLocal Comanda'` |
| `enlocal_dump_` (en filtros de listDumps) | `enlocal_comanda_dump_` |

**Nombre de archivo de dumps:**
```
enlocal_comanda_dump_{YYYY-MM-DD}_{HH-mm-ss}_v{version}.dump
```

**El pg_dump command queda:**
```
pg_dump -h 127.0.0.1 -p 5434 -U enlocal -Fc -Z 9 -f "filepath" enlocal_comanda
```

---

### 3. `apps/comanda-pro/electron/server/backup/backupScheduler.ts`

Copiar **idéntico** de `apps/caja/electron/server/backup/backupScheduler.ts`. No requiere cambios porque usa las instancias que se le pasan por constructor. Solo asegurarse que los imports apunten a los archivos locales:

```typescript
import type { SmartBackupService } from './smartBackupService'
```

---

### 4. `apps/comanda-pro/electron/server/backup/backupRoutes.ts`

Copiar **idéntico** de `apps/caja/electron/server/backup/backupRoutes.ts`. No requiere cambios porque crea instancias con la config que recibe por parámetro.

---

## Integración en server/index.ts

En `apps/comanda-pro/electron/server/index.ts`, agregar después del montaje de rutas base:

```typescript
import { createBackupRoutes } from './backup/backupRoutes'
import { SmartBackupService } from './backup/smartBackupService'
import { BackupScheduler } from './backup/backupScheduler'

// ─── Mount backup routes ───
const appVersion = require('../../package.json').version || '1.0.0'
const backupRoutes = createBackupRoutes(pool, {
  dbName: config.dbName,     // 'enlocal_comanda'
  dbPort: config.pgPort,     // 5434
  dbUser: 'enlocal',
  dbPassword: 'enlocal',
  appVersion,
})
app.use('/api/backups', backupRoutes)

// ─── Initialize backup scheduler ───
const smartBackup = new SmartBackupService(pool, {
  dbName: config.dbName,
  dbPort: config.pgPort,
  dbUser: 'enlocal',
  dbPassword: 'enlocal',
  appVersion,
})
const backupScheduler = new BackupScheduler(smartBackup)
app.set('backupScheduler', backupScheduler)
```

El `startServer` debe retornar `backupScheduler` en su promise resolve:
```typescript
return { httpServer, io, backupScheduler }
```

---

## Integración en electron/main.ts

### Variable global
```typescript
let backupSchedulerRef: any = null
```

### Después de startServer (en boot sequence)
```typescript
const { io, backupScheduler } = await startServer({...})

backupSchedulerRef = backupScheduler
if (launcherWindow) {
  backupScheduler.init(launcherWindow)
  log('[Backup] Scheduler initialized')
}
```

### IPC Handlers (agregar dentro de registerIpcHandlers o equivalente)

```typescript
// ─── Backup IPC handlers ───

ipcMain.handle('backup:create', async (_event, tipo = 'manual') => {
  if (!backupSchedulerRef) return { error: 'Backup system not initialized' }
  try {
    return await backupSchedulerRef.smart?.createBackup(tipo)
  } catch (e: any) {
    return { error: e.message }
  }
})

ipcMain.handle('backup:list', async () => {
  if (!backupSchedulerRef) return { error: 'Backup system not initialized' }
  try {
    return backupSchedulerRef.smart?.getBackupInfo()
  } catch (e: any) {
    return { error: e.message }
  }
})

ipcMain.handle('backup:open-folder', async () => {
  if (!backupSchedulerRef?.smart?.backupDir) return
  shell.openPath(backupSchedulerRef.smart.backupDir)
})

ipcMain.handle('backup:change-directory', async () => {
  const win = posWindow || launcherWindow
  if (!win) return { cancelled: true }
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Seleccionar carpeta de respaldos',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || filePaths.length === 0) return { cancelled: true }
  return backupSchedulerRef?.smart?.setCustomBackupDirectory(filePaths[0])
})

ipcMain.handle('backup:restore-external', async () => {
  const win = posWindow || launcherWindow
  if (!win) return { cancelled: true }
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Seleccionar respaldo',
    filters: [
      { name: 'Respaldos enLocal', extensions: ['enlocal-backup'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { cancelled: true }
  const manifest = backupSchedulerRef?.smart?.readBackupManifest(filePaths[0])
  if (!manifest) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Archivo no válido',
      message: 'Este archivo no es un respaldo compatible de enLocal.',
    })
    return { cancelled: true, error: 'Formato no válido' }
  }
  return { filepath: filePaths[0], manifest }
})

ipcMain.handle('backup:restore-full-dump-dialog', async () => {
  const win = posWindow || launcherWindow
  if (!win) return { cancelled: true }
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Seleccionar dump completo',
    filters: [
      { name: 'Dumps PostgreSQL', extensions: ['dump', 'sql', 'backup'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { cancelled: true }
  return { filepath: filePaths[0] }
})
```

### En `before-quit`
```typescript
app.on('before-quit', async () => {
  if (backupSchedulerRef) {
    try {
      await backupSchedulerRef.onAppClose()
    } catch {
      // Non-critical: app is closing anyway
    }
  }
  pgManager.shutdown().catch(err => {
    console.error('[ComandaPro] PgManager shutdown error:', err)
  })
})
```

---

## Triggers desde turnos/comandas

En Caja, los backups se disparan en apertura/cierre de turno (cash shifts). En Comanda Pro, si existe un concepto equivalente (apertura/cierre de jornada, o inicio/fin de servicio), agregar:

```typescript
// En la ruta de apertura de jornada/servicio:
try {
  const backupScheduler = req.app.get('backupScheduler')
  if (backupScheduler?.onTurnoApertura) {
    backupScheduler.onTurnoApertura().catch(() => {})
  }
} catch { /* non-critical */ }

// En la ruta de cierre de jornada/servicio:
try {
  const backupScheduler = req.app.get('backupScheduler')
  if (backupScheduler?.onTurnoCierre) {
    backupScheduler.onTurnoCierre().catch(() => {})
  }
} catch { /* non-critical */ }
```

Si Comanda Pro no tiene ese concepto, el scheduler automático (cada 4 horas) + backup al cerrar la app serán suficientes.

---

## Resumen de diferencias clave con Caja

| Concepto | Caja | Comanda Pro |
|----------|------|-------------|
| DB name | `enlocal_caja` | `enlocal_comanda` |
| PG port | `5433` | `5434` |
| Prefijo archivos backup | `enlocal_caja_` | `enlocal_comanda_` |
| Prefijo archivos dump | `enlocal_dump_` | `enlocal_comanda_dump_` |
| Carpeta respaldos | `enLocal Caja/Respaldos` | `enLocal Comanda/Respaldos` |
| State file | `backup-state.json` | `comanda-backup-state.json` |
| Google Drive folder | `enLocal Caja` | `enLocal Comanda` |
| Express port | `8214` | `9006` |

**Todo lo demás es idéntico:** formato de backup, compresión, rotación, restauración cross-version, API REST, IPC handlers, scheduler.

---

## Checklist de validación

- [ ] Smart backups se guardan en `~/Documents/enLocal Comanda/Respaldos/`
- [ ] Full dumps se guardan en `.../Respaldos/dumps-completos/`
- [ ] Google Drive se detecta y usa `enLocal Comanda/Respaldos`
- [ ] State file es `comanda-backup-state.json` (no choca con Caja)
- [ ] Archivos se nombran `enlocal_comanda_*`
- [ ] `listBackups()` filtra por `enlocal_comanda_`
- [ ] `listDumps()` filtra por `enlocal_comanda_dump_`
- [ ] pg_dump usa puerto `5434`
- [ ] IPC handlers registrados en main.ts
- [ ] Scheduler se inicializa tras startServer
- [ ] `before-quit` ejecuta `onAppClose()`
- [ ] Backup routes montadas en `/api/backups`
