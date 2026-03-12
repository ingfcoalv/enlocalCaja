# Plan de Implementacion: Multi-Caja para enLocal Caja

> **Estado**: Planificado
> **Fecha**: 2026-03-05
> **Fases**: 5

---

## Resumen

Implementar soporte Multi-Caja que permita operar multiples cajas (registros) de forma independiente:
aperturas, cierres, ventas, movimientos de efectivo y reportes separados por caja.

La funcionalidad se activa via addon de licencia (`multicaja`). Sin el addon, el sistema
opera igual que hoy (caja unica implicita).

---

## FASE 1: Base de Datos y Licencia

**Objetivo**: Crear las tablas nuevas, campos adicionales, y configurar el sistema de licencia
para reconocer el addon `multicaja`.

### 1.1 Migracion SQL: `0019_multicaja.sql`

**Archivo**: `packages/core-db/migrations/0019_multicaja.sql`

Crear tabla `cash_movements` (movimientos de caja):
```sql
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  register_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,              -- 'deposit' | 'withdrawal'
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,            -- 'change_fund' | 'expense' | 'transfer_out' | 'transfer_in' | 'correction' | 'other'
  notes text,
  authorized_by uuid,              -- para retiros que requieren autorizacion
  related_movement_id uuid,        -- para transferencias entre cajas (vincula deposit<->withdrawal)
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Crear tabla `register_sequences` (folios por caja):
```sql
CREATE TABLE IF NOT EXISTS register_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL UNIQUE,
  series text NOT NULL,            -- 'C1', 'C2', etc.
  last_folio integer NOT NULL DEFAULT 0
);
```

Agregar campos de resumen a `cash_shifts`:
```sql
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_cash_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_card_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_transfer_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_deposits numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_withdrawals numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS transactions_count integer DEFAULT 0;
```

### 1.2 Actualizar `_journal.json`

**Archivo**: `packages/core-db/migrations/meta/_journal.json`

Agregar entrada idx=16 con tag `0019_multicaja`.

### 1.3 core-license: Tipos

**Archivo**: `packages/core-license/src/types.ts`

- Agregar `maxRegisters?: number` a `LicenseFile`
- Agregar `maxRegisters?: number` a `ValidationResult`
- Agregar `max_registers?: number` a `CloudValidationResponse`

### 1.4 core-license: Validator

**Archivo**: `packages/core-license/src/validator.ts`

- En `ADDON_TO_MODULE` agregar: `multicaja: 'mod-multicaja'`
- En `validateLicense()`, leer `cloud.max_registers` y guardarlo en licenseFile
- Pasar `maxRegisters` en el `ValidationResult` de retorno

### 1.5 core-license: Module Access

**Archivo**: `packages/core-license/src/moduleAccess.ts`

- En `SOFTWARE_MODULES['enlocal-caja'].addons` agregar `'mod-multicaja'`
- En `MODULE_DEPENDENCIES` agregar: `'mod-multicaja': ['mod-pos']`

### 1.6 core-license: moduleActivation.service.ts

Sincronizar `license_max_registers` a la tabla `settings` para que el backend pueda consultarlo.

### 1.7 react-hooks: useModuleAccess.ts

**Archivo**: `packages/react-hooks/src/useModuleAccess.ts`

- En `MODULE_DEPENDENCIES` (duplicado frontend) agregar: `'mod-multicaja': ['mod-pos']`

### 1.8 react-hooks: useLicenseStore.ts

**Archivo**: `packages/react-hooks/src/useLicenseStore.ts`

- Agregar `maxRegisters: number` al state
- Popularlo desde `GET /api/license/full-info`

### Archivos a modificar (Fase 1):
| Archivo | Accion |
|---------|--------|
| `packages/core-db/migrations/0019_multicaja.sql` | CREAR |
| `packages/core-db/migrations/meta/_journal.json` | EDITAR - agregar entrada idx=16 |
| `packages/core-license/src/types.ts` | EDITAR - agregar maxRegisters |
| `packages/core-license/src/validator.ts` | EDITAR - leer max_registers, mapear multicaja |
| `packages/core-license/src/moduleAccess.ts` | EDITAR - addon + dependencia |
| `packages/core-license/src/moduleActivation.service.ts` | EDITAR - sync maxRegisters a settings |
| `packages/react-hooks/src/useModuleAccess.ts` | EDITAR - dependencia mod-multicaja |
| `packages/react-hooks/src/useLicenseStore.ts` | EDITAR - exponer maxRegisters |

### Verificacion Fase 1:
- [ ] Migracion SQL corre sin errores
- [ ] `_journal.json` tiene la entrada nueva
- [ ] Addon `multicaja` se mapea correctamente a `mod-multicaja`
- [ ] `max_registers` se lee de cloud y se guarda en licenseFile
- [ ] `useModuleAccess('multicaja')` retorna `hasAccess: true` cuando el addon esta presente
- [ ] Sin addon, todo funciona exactamente igual que antes

---

## FASE 2: Logica de Negocio (Backend)

**Objetivo**: Implementar servicios y rutas para movimientos de caja, Corte X,
reforzar validaciones multi-caja, y agregar permisos granulares.

### 2.1 Nuevo servicio: `cashMovements.service.ts`

**Archivo**: `packages/mod-pos/src/services/cashMovements.service.ts` (CREAR)

Funciones:
- `ensureCashMovementsTable(db)` — CREATE TABLE IF NOT EXISTS
- `createMovement(db, { shiftId, registerId, userId, type, amount, reason, notes, authorizedBy })` — INSERT + retornar movimiento
- `createTransfer(db, { fromShiftId, fromRegisterId, toShiftId, toRegisterId, userId, amount, notes })` — Crea par de movimientos (withdrawal + deposit) vinculados por `related_movement_id`
- `getMovementsByShift(db, shiftId)` — Listar movimientos de un turno
- `getMovementsByRegister(db, registerId, filters)` — Listar movimientos de una caja con paginacion y filtros de fecha
- `getMovementsSummary(db, shiftId)` — Totales de depositos y retiros para un turno

### 2.2 Nuevas rutas: `cashMovements.routes.ts`

**Archivo**: `packages/mod-pos/src/routes/cashMovements.routes.ts` (CREAR)

Endpoints:
- `POST /api/pos/movements` — Crear movimiento (deposit/withdrawal)
  - Requiere permiso `pos.movements.create`
  - Si type=withdrawal y amount > umbral, requiere `pos.movements.authorize` o `authorized_by`
- `POST /api/pos/movements/transfer` — Transferencia entre cajas
  - Requiere permiso `pos.movements.create`
  - Valida que ambas cajas tengan turno abierto
- `GET /api/pos/movements?shiftId=...&registerId=...&from=...&to=...` — Listar movimientos
  - Requiere permiso `pos.read`
- `GET /api/pos/movements/summary?shiftId=...` — Resumen de movimientos de un turno

### 2.3 Modificar `cashShifts.service.ts`

**Archivo**: `packages/mod-pos/src/services/cashShifts.service.ts`

Cambios en `openShift()`:
- Recibir parametro `multicajaEnabled: boolean`
- Si `multicajaEnabled === true`: exigir `registerId` (throw si es null)
- Validar max_registers: contar registros activos con turno abierto vs limite de licencia

Cambios en `closeShift()`:
- Incluir movimientos de caja en calculo de esperado:
  ```
  expected = opening + cash_payments + deposits - withdrawals
  ```
- Calcular y guardar campos de resumen (total_sales, total_cash_sales, etc.)
- Guardar desglose por metodo de pago

Nuevo: `getShiftPreview()` (Corte X):
- Misma logica que closeShift pero SIN actualizar la BD
- Retorna: opening, cash_payments, deposits, withdrawals, expected, current count de transacciones
- Permite al cajero ver estado actual sin cerrar turno

### 2.4 Modificar `cashShifts.routes.ts`

**Archivo**: `packages/mod-pos/src/routes/cashShifts.routes.ts`

Cambios en `POST /open`:
- Leer `licenseInfo.multicajaEnabled` (o verificar si mod-multicaja esta en enabledModules)
- Pasar flag a `openShift()`
- Validar `max_registers` ademas de `max_terminals`

Nuevo endpoint `GET /current/preview` (Corte X):
- Requiere permiso `pos.read`
- Llama a `getShiftPreview(db, shiftId)`
- Retorna estado actual del turno sin cerrarlo

Cambios en `POST /close`:
- Pasar datos de resumen calculados

Cambios en `GET /history`:
- Aceptar filtro `registerId` para filtrar por caja
- Aceptar filtro `userId` para filtrar por cajero

### 2.5 Modificar `sales.routes.ts`

**Archivo**: `packages/mod-pos/src/routes/sales.routes.ts`

Cambios en `POST /` (crear venta):
- Si multicaja activo, validar que el turno tiene `registerId`
- Usar serie de folio de la caja (register_sequences) si existe

Cambios en `GET /` (listar ventas):
- Aceptar filtro `registerId`

Cambios en `GET /dashboard`:
- Aceptar filtro `registerId`

Cambios en `GET /summary`:
- Aceptar filtro `registerId`

### 2.6 Modificar `registers.service.ts`

**Archivo**: `packages/mod-pos/src/services/registers.service.ts`

Cambios en `createRegister()`:
- Validar `max_registers` de licencia antes de crear
- Auto-generar serie en `register_sequences` (C1, C2, etc.)

### 2.7 Montar nuevas rutas

**Archivo**: `packages/mod-pos/src/mount.ts`

- Importar y montar `cashMovementsRoutes` en `/api/pos/movements`

### 2.8 Permisos granulares

Agregar nuevos permisos al sistema de roles (en la migracion o en el servicio de roles):

| Permiso | Descripcion |
|---------|-------------|
| `pos.register.manage` | Crear, editar, desactivar cajas |
| `pos.register.open` | Abrir turno en una caja |
| `pos.register.close_others` | Cerrar turno de otro cajero (admin) |
| `pos.movements.create` | Crear entradas/salidas de efectivo |
| `pos.movements.authorize` | Autorizar retiros de efectivo |

Estos se agregan a los roles del sistema existentes:
- `admin`/`owner`: todos los permisos
- `manager`: todos excepto `pos.register.manage`
- `cashier`: `pos.register.open`, `pos.movements.create`

### Archivos a modificar (Fase 2):
| Archivo | Accion |
|---------|--------|
| `packages/mod-pos/src/services/cashMovements.service.ts` | CREAR |
| `packages/mod-pos/src/routes/cashMovements.routes.ts` | CREAR |
| `packages/mod-pos/src/services/cashShifts.service.ts` | EDITAR - validaciones, Corte X, resumen cierre |
| `packages/mod-pos/src/routes/cashShifts.routes.ts` | EDITAR - multicaja validation, preview endpoint, filtros |
| `packages/mod-pos/src/routes/sales.routes.ts` | EDITAR - filtro registerId, serie de folio |
| `packages/mod-pos/src/services/registers.service.ts` | EDITAR - validar max_registers, auto-generar serie |
| `packages/mod-pos/src/mount.ts` | EDITAR - montar cashMovements routes |
| `packages/mod-pos/src/services/sales.service.ts` | EDITAR - filtro registerId en queries |

### Verificacion Fase 2:
- [ ] Crear movimiento de caja (deposit/withdrawal) funciona
- [ ] Transferencia entre cajas crea par vinculado
- [ ] Cierre calcula esperado incluyendo movimientos
- [ ] Corte X retorna preview sin cerrar turno
- [ ] Con multicaja activo, apertura sin caja es rechazada
- [ ] Sin multicaja, apertura sin caja sigue funcionando
- [ ] Reportes filtran por registerId
- [ ] max_registers se valida al crear nueva caja
- [ ] Permisos granulares funcionan

---

## FASE 3: Frontend - Menus, Paginas y UI

**Objetivo**: Agregar menus condicionales, paginas nuevas (estado de cajas, movimientos,
Corte X), y reforzar la UI de apertura/cierre.

### 3.1 Layout: Menus condicionales

**Archivo**: `apps/caja/webapp/src/components/Layout.tsx`

Agregar al `moduleGate`:
```typescript
multicaja: hasMulticaja,
```

Agregar nuevo grupo de navegacion (entre Ventas y Remisiones):
```typescript
{
  label: 'Multi-Caja',
  icon: Monitor,
  module: 'multicaja',
  items: [
    { to: '/registers/status', label: 'Estado de Cajas', icon: Monitor },
    { to: '/registers/movements', label: 'Movimientos', icon: ArrowLeftRight },
    { to: '/registers/reports', label: 'Reportes por Caja', icon: BarChart3 },
  ],
}
```

### 3.2 App.tsx: Nuevas rutas

**Archivo**: `apps/caja/webapp/src/App.tsx`

Agregar rutas:
```
/registers/status     → RegisterStatusPage
/registers/movements  → CashMovementsPage
/registers/reports    → RegisterReportsPage
```

### 3.3 Pagina: Estado de Cajas (`RegisterStatusPage.tsx`)

**Archivo**: `apps/caja/webapp/src/pages/RegisterStatusPage.tsx` (CREAR)

Dashboard que muestra todas las cajas en tarjetas:
- Nombre de caja
- Estado: Abierta (verde) / Cerrada (gris)
- Cajero actual (si abierta)
- Hora de apertura
- Ventas acumuladas del turno
- Monto en caja estimado
- Boton "Cerrar turno" (solo admin/manager, para cerrar turno ajeno)

Usa `GET /api/pos/registers` con status (ya existe: `listRegistersWithStatus`).
Para datos en vivo del turno, usa `GET /api/pos/shifts/current/preview?registerId=...`

### 3.4 Pagina: Movimientos de Caja (`CashMovementsPage.tsx`)

**Archivo**: `apps/caja/webapp/src/pages/CashMovementsPage.tsx` (CREAR)

- Formulario para crear deposito/retiro
- Selector de caja (si multicaja)
- Campo de monto y razon
- Campo de notas (opcional)
- Boton de "Autorizar" para retiros grandes (muestra modal de PIN de autorizador)
- Formulario de transferencia entre cajas
- Tabla historica de movimientos con filtros (fecha, caja, tipo)

Usa `POST /api/pos/movements` y `GET /api/pos/movements`

### 3.5 Pagina: Reportes por Caja (`RegisterReportsPage.tsx`)

**Archivo**: `apps/caja/webapp/src/pages/RegisterReportsPage.tsx` (CREAR)

- Selector de caja y rango de fechas
- Resumen: ventas por caja, desglose por metodo de pago
- Tabla comparativa de cajas (ventas, transacciones, diferencias de cierre)
- Grafico de ventas por hora por caja

Usa `GET /api/sales/dashboard?registerId=...` y `GET /api/pos/shifts/history?registerId=...`

### 3.6 Modificar PosPage: Apertura obligatoria de caja

**Archivo**: `apps/caja/webapp/src/pages/PosPage.tsx`

Cambios:
- Si multicaja activo: dropdown de caja es **obligatorio** (no opcional)
- Deshabilitar en dropdown las cajas que ya tienen turno abierto
- Mostrar badge en header: "Caja 2 - Turno abierto" (verde)
- Agregar boton "Corte X" junto al boton de cerrar turno
- Modal de Corte X: muestra preview del cierre sin ejecutarlo

### 3.7 Modificar PosPage: Modal de Corte X

En PosPage (o componente separado):
- Modal que llama a `GET /api/pos/shifts/current/preview`
- Muestra: apertura, ventas en efectivo, depositos, retiros, esperado
- Muestra desglose por metodo de pago
- Boton "Solo consulta" (cierra modal) y "Cerrar turno" (procede al cierre)

### 3.8 Store: usePosStore updates

**Archivo**: `apps/caja/webapp/src/stores/usePosStore.ts`

Agregar:
- `multicajaEnabled: boolean` — consultado desde `useModuleAccess`
- `fetchShiftPreview()` — llama a preview endpoint
- `shiftPreview: ShiftPreview | null`

### 3.9 Store: useCashMovementsStore

**Archivo**: `apps/caja/webapp/src/stores/useCashMovementsStore.ts` (CREAR)

- `movements: CashMovement[]`
- `loading: boolean`
- `fetchMovements(filters)`
- `createMovement(data)`
- `createTransfer(data)`

### 3.10 Nombre de caja en tickets

**Archivo**: `packages/mod-pos/src/services/receipts.service.ts`

Agregar nombre de caja y cajero al template del ticket:
```
Caja: {registerName}
Atendio: {userName}
```

### Archivos a modificar (Fase 3):
| Archivo | Accion |
|---------|--------|
| `apps/caja/webapp/src/components/Layout.tsx` | EDITAR - agregar grupo Multi-Caja |
| `apps/caja/webapp/src/App.tsx` | EDITAR - agregar rutas |
| `apps/caja/webapp/src/pages/RegisterStatusPage.tsx` | CREAR |
| `apps/caja/webapp/src/pages/CashMovementsPage.tsx` | CREAR |
| `apps/caja/webapp/src/pages/RegisterReportsPage.tsx` | CREAR |
| `apps/caja/webapp/src/pages/PosPage.tsx` | EDITAR - caja obligatoria, badge, Corte X |
| `apps/caja/webapp/src/stores/usePosStore.ts` | EDITAR - preview, multicaja flag |
| `apps/caja/webapp/src/stores/useCashMovementsStore.ts` | CREAR |
| `packages/mod-pos/src/services/receipts.service.ts` | EDITAR - nombre caja en ticket |

### Verificacion Fase 3:
- [ ] Grupo "Multi-Caja" solo visible con addon multicaja
- [ ] Estado de Cajas muestra dashboard en tiempo real
- [ ] Movimientos de Caja permite depositos, retiros y transferencias
- [ ] Reportes por Caja filtra correctamente
- [ ] PosPage exige caja cuando multicaja activo
- [ ] PosPage muestra badge con nombre de caja
- [ ] Corte X muestra preview sin cerrar turno
- [ ] Ticket imprime nombre de caja y cajero
- [ ] Sin addon multicaja, nada cambia en la UI

---

## FASE 4: Sincronizacion Cloud y Auditoria

**Objetivo**: Asegurar que todos los datos de multi-caja se sincronizan correctamente
con cloud y quedan registrados en change_journal.

### 4.1 Sync: Registros de caja

Cuando se crea/edita un `pos_register`, encolar en `sync_queue`:
```json
{
  "entity_type": "register",
  "payload": {
    "local_id": "uuid",
    "name": "Caja 1",
    "series": "C1",
    "is_active": true
  }
}
```

### 4.2 Sync: Movimientos de caja

Cuando se crea un `cash_movement`, encolar:
```json
{
  "entity_type": "cash_movement",
  "payload": {
    "local_id": "uuid",
    "shift_cloud_id": "...",
    "register_cloud_id": "...",
    "user_cloud_id": "...",
    "type": "deposit",
    "amount": 500.00,
    "reason": "change_fund",
    "notes": "...",
    "related_movement_cloud_id": "...",
    "created_at": "..."
  }
}
```

### 4.3 Sync: Turno con resumen

Modificar el payload de `shift_close` para incluir campos de resumen:
```json
{
  "entity_type": "shift_close",
  "payload": {
    "register_cloud_id": "...",
    "user_cloud_id": "...",
    "opening_amount": 1000,
    "closing_amount": 5420,
    "expected_amount": 5500,
    "difference": -80,
    "total_sales": 6200,
    "total_cash_sales": 4500,
    "total_card_sales": 1200,
    "total_transfer_sales": 500,
    "total_deposits": 500,
    "total_withdrawals": 200,
    "transactions_count": 34,
    "opened_at": "...",
    "closed_at": "..."
  }
}
```

### 4.4 Sync: Ventas con register_cloud_id

El payload de ventas (`buildSalePayload` en core-sync) ya incluye `register_cloud_id`.
Verificar que se envia correctamente.

### 4.5 Auditoria: change_journal

Asegurar que se registran en `change_journal`:
- Creacion/edicion de registros (pos_registers)
- Apertura y cierre de turnos (cash_shifts)
- Movimientos de caja (cash_movements)
- Transferencias entre cajas

### 4.6 Modificar registers.service.ts para cloud_id

Cuando cloud responda con IDs, guardar en `id_mappings` y `pos_registers.cloud_id`.

### Archivos a modificar (Fase 4):
| Archivo | Accion |
|---------|--------|
| `packages/mod-pos/src/services/cashMovements.service.ts` | EDITAR - agregar sync_queue insert |
| `packages/mod-pos/src/routes/cashShifts.routes.ts` | EDITAR - mejorar payload de sync |
| `packages/mod-pos/src/routes/registers.routes.ts` | EDITAR - encolar sync al crear/editar |
| `packages/core-sync/src/payloads.ts` (o equivalente) | EDITAR - payload de register y cash_movement |

### Verificacion Fase 4:
- [ ] Crear caja encola sync con entity_type=register
- [ ] Crear movimiento encola sync con entity_type=cash_movement
- [ ] Cierre de turno envía resumen completo
- [ ] Ventas incluyen register_cloud_id
- [ ] change_journal registra todas las operaciones
- [ ] id_mappings se actualizan cuando cloud responde

---

## FASE 5: Documentacion Cloud (`readme_multicaja_cloud.md`)

**Objetivo**: Crear documentacion para el equipo de Cloud sobre que datos recibira
y que endpoints/tablas debe implementar.

**Archivo**: `readme_multicaja_cloud.md` (CREAR en raiz del proyecto)

Contenido completo en la seccion siguiente.

---

## Diagrama de Dependencias entre Fases

```
FASE 1 (DB + Licencia)
  |
  v
FASE 2 (Backend: servicios + rutas)
  |
  v
FASE 3 (Frontend: paginas + UI)
  |
  v
FASE 4 (Sync + Auditoria)
  |
  v
FASE 5 (Documentacion Cloud)
```

Las fases son secuenciales. Cada una depende de la anterior.

---

## Resumen de Archivos por Fase

### Fase 1 (8 archivos)
- 1 CREAR: migracion SQL
- 7 EDITAR: _journal, types, validator, moduleAccess, moduleActivation, useModuleAccess, useLicenseStore

### Fase 2 (10 archivos)
- 2 CREAR: cashMovements.service.ts, cashMovements.routes.ts
- 8 EDITAR: cashShifts.service, cashShifts.routes, sales.routes, registers.service, mount.ts, sales.service, payments.service (permisos)

### Fase 3 (9 archivos)
- 4 CREAR: RegisterStatusPage, CashMovementsPage, RegisterReportsPage, useCashMovementsStore
- 5 EDITAR: Layout, App.tsx, PosPage, usePosStore, receipts.service

### Fase 4 (4 archivos)
- 0 CREAR
- 4 EDITAR: cashMovements.service, cashShifts.routes, registers.routes, core-sync payloads

### Fase 5 (1 archivo)
- 1 CREAR: readme_multicaja_cloud.md

**Total: 7 archivos nuevos, ~24 archivos editados**

---

## Retrocompatibilidad

CRITICO: Sin el addon `multicaja`:
- Todas las tablas nuevas existen pero no se usan activamente
- `register_id` sigue siendo opcional en turnos, pagos e invoices
- Los menus de Multi-Caja no aparecen
- El flujo de apertura/cierre es identico al actual
- Los reportes no muestran filtros de caja
- No se valida max_registers
- Movimientos de caja no se exponen en la UI

Con el addon `multicaja`:
- Apertura de turno exige seleccion de caja
- Cierre incluye movimientos en el calculo
- Menus de Multi-Caja visibles
- Reportes filtran por caja
- max_registers limita creacion de cajas
