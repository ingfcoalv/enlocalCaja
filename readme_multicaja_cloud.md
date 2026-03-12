# Multi-Caja: Guia de Implementacion para Cloud

> Documento tecnico para el equipo de Cloud (todoenlocal.com)
> Fecha: 2026-03-05

---

## 1. Resumen

El sistema de escritorio (enLocal Caja) implementara soporte para multiples cajas (registros)
operando en paralelo. Cloud debe:

1. **Enviar** el addon `multicaja` y `max_registers` en la validacion de licencia
2. **Recibir** datos sincronizados de cajas, turnos, movimientos de caja y ventas por caja
3. **Almacenar** estos datos para reportes consolidados en el panel web

---

## 2. Cambios en la API de Licencia

### 2.1 Validacion de Licencia (ya existente)

**Endpoint**: `POST /api/v1/licenses/validate`

El response **ya incluye** `addons[]` y `max_terminals`. Se deben agregar:

```json
{
  "valid": true,
  "license": { ... },
  "business": { ... },
  "branch": { ... },
  "terminal": { ... },
  "product": { "id": "...", "code": "enlocal_caja", "name": "enLocal Caja" },
  "is_linked": true,
  "addons": ["facturacion", "inventario", "multicaja"],   // <-- NUEVO: "multicaja"
  "stamps_available": 50,
  "max_terminals": 3,
  "max_registers": 4                                       // <-- NUEVO campo
}
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `"multicaja"` en addons | string | Activa el modulo multi-caja en el escritorio. Sin esto, opera en modo caja unica. |
| `max_registers` | number | Maximo de cajas fisicas que el negocio puede crear. Ej: plan intermedio=2, plan premium=5, enterprise=ilimitado. |

### 2.2 Que planes incluyen multicaja

Esto lo define Cloud segun la logica de negocio. Sugerencia:

| Plan/pos_type | multicaja | max_registers | max_terminals |
|---------------|-----------|---------------|---------------|
| basico        | NO        | 1 (implicita) | 1 |
| intermedio    | SI        | 2             | 2 |
| premium       | SI        | 5             | 5 |
| enterprise    | SI        | 99            | 99 |

---

## 3. Datos que el Escritorio Sincroniza a Cloud

El escritorio usa la tabla `sync_queue` para encolar datos que se envian via:

**Endpoint existente**: `POST /api/v1/pos-sync/push?token=...`

El body del push contiene un array de entidades. Se agregan 3 nuevos `entity_type`:

### 3.1 entity_type: `register` (Caja)

Se envia cuando se crea o edita una caja.

```json
{
  "entity_type": "register",
  "entity_local_id": "uuid-local",
  "payload": {
    "local_id": "a1b2c3d4-...",
    "name": "Caja 1",
    "series": "C1",
    "is_active": true,
    "created_at": "2026-03-05T10:00:00Z",
    "updated_at": "2026-03-05T10:00:00Z"
  }
}
```

**Cloud debe**:
- Crear/actualizar registro en tabla `pos_registers` (o equivalente)
- Retornar `cloud_id` en el response del push para que el escritorio lo guarde en `id_mappings`
- Asociar el registro al `branch_id` de la licencia

### 3.2 entity_type: `cash_movement` (Movimiento de Caja)

Se envia cuando se crea un deposito, retiro o transferencia.

```json
{
  "entity_type": "cash_movement",
  "entity_local_id": "uuid-local",
  "payload": {
    "local_id": "e5f6g7h8-...",
    "shift_cloud_id": "cloud-shift-id",
    "register_cloud_id": "cloud-register-id",
    "user_cloud_id": "cloud-user-id",
    "type": "deposit",
    "amount": 500.00,
    "reason": "change_fund",
    "notes": "Fondo de cambio para la tarde",
    "authorized_by_cloud_id": null,
    "related_movement_cloud_id": null,
    "created_at": "2026-03-05T14:30:00Z"
  }
}
```

**Valores de `type`**:
| Valor | Descripcion |
|-------|-------------|
| `deposit` | Entrada de efectivo a la caja |
| `withdrawal` | Salida de efectivo de la caja |

**Valores de `reason`**:
| Valor | Descripcion |
|-------|-------------|
| `change_fund` | Fondo de cambio |
| `expense` | Gasto operativo |
| `transfer_out` | Salida por transferencia a otra caja |
| `transfer_in` | Entrada por transferencia desde otra caja |
| `correction` | Correccion/ajuste |
| `other` | Otro motivo (ver notes) |

**Transferencias entre cajas**:
Cuando se hace una transferencia de Caja 1 a Caja 2, se generan 2 movimientos:
1. `type: "withdrawal"`, `reason: "transfer_out"` en Caja 1
2. `type: "deposit"`, `reason: "transfer_in"` en Caja 2

Ambos se vinculan por `related_movement_cloud_id` (o `related_movement_local_id` si cloud aun no tiene IDs).

### 3.3 entity_type: `shift_close` (Cierre de Turno) — MODIFICADO

El payload de cierre de turno **ya existe** pero se extiende con campos nuevos:

```json
{
  "entity_type": "shift_close",
  "entity_local_id": "uuid-local",
  "payload": {
    "local_id": "i9j0k1l2-...",
    "register_cloud_id": "cloud-register-id",
    "user_cloud_id": "cloud-user-id",
    "opening_amount": 1000.00,
    "closing_amount": 5420.00,
    "expected_amount": 5500.00,
    "difference": -80.00,
    "status": "closed",
    "opened_at": "2026-03-05T08:00:00Z",
    "closed_at": "2026-03-05T16:00:00Z",
    "notes": "Faltaron $80",

    "total_sales": 6200.00,
    "total_cash_sales": 4500.00,
    "total_card_sales": 1200.00,
    "total_transfer_sales": 500.00,
    "total_deposits": 500.00,
    "total_withdrawals": 200.00,
    "transactions_count": 34
  }
}
```

**Campos nuevos** (todos los que empiezan con `total_` y `transactions_count`):
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `total_sales` | numeric | Total general de ventas en el turno |
| `total_cash_sales` | numeric | Total de pagos en efectivo |
| `total_card_sales` | numeric | Total de pagos con tarjeta |
| `total_transfer_sales` | numeric | Total de pagos por transferencia |
| `total_deposits` | numeric | Total de depositos/entradas de efectivo |
| `total_withdrawals` | numeric | Total de retiros/salidas de efectivo |
| `transactions_count` | integer | Numero de ventas realizadas |

### 3.4 entity_type: `sale` — SIN CAMBIOS

El payload de ventas ya incluye `register_cloud_id`. No hay cambios estructurales.

```json
{
  "entity_type": "sale",
  "entity_local_id": "invoice-uuid",
  "payload": {
    "register_cloud_id": "cloud-register-id",
    "cashier_cloud_id": "cloud-user-id",
    ...
  }
}
```

---

## 4. Tablas que Cloud debe crear/modificar

### 4.1 Nueva tabla: `pos_registers`

```sql
CREATE TABLE pos_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  terminal_id uuid REFERENCES terminals(id),
  name text NOT NULL,
  series text,
  is_active boolean DEFAULT true,
  local_id text,                    -- UUID del escritorio
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_pos_registers_branch_local
  ON pos_registers(branch_id, local_id);
```

### 4.2 Nueva tabla: `cash_movements`

```sql
CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  shift_id uuid NOT NULL REFERENCES cash_shifts(id),
  register_id uuid NOT NULL REFERENCES pos_registers(id),
  user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL,               -- 'deposit' | 'withdrawal'
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  notes text,
  authorized_by uuid REFERENCES users(id),
  related_movement_id uuid REFERENCES cash_movements(id),
  local_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cash_movements_shift ON cash_movements(shift_id);
CREATE INDEX idx_cash_movements_register ON cash_movements(register_id);
```

### 4.3 Modificar tabla: `cash_shifts` (agregar columnas)

```sql
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS register_id uuid REFERENCES pos_registers(id);
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_cash_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_card_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_transfer_sales numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_deposits numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_withdrawals numeric(12,2) DEFAULT 0;
ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS transactions_count integer DEFAULT 0;
```

### 4.4 Verificar tabla: `sales` / `invoices`

La columna `register_id` ya deberia existir. Si no:

```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS register_id uuid REFERENCES pos_registers(id);
```

---

## 5. Response del Push (cloud_ids)

Cuando Cloud recibe un push con entidades nuevas, debe retornar los `cloud_id` asignados
para que el escritorio actualice sus `id_mappings`.

**Response existente del push**:
```json
{
  "success": true,
  "processed": 5,
  "id_mappings": [
    { "entity_type": "register", "local_id": "a1b2c3d4-...", "cloud_id": "cloud-uuid-1" },
    { "entity_type": "cash_movement", "local_id": "e5f6g7h8-...", "cloud_id": "cloud-uuid-2" },
    { "entity_type": "shift_close", "local_id": "i9j0k1l2-...", "cloud_id": "cloud-uuid-3" }
  ]
}
```

El escritorio guardara estos mappings en su tabla `id_mappings` para futuras referencias.

---

## 6. Endpoints Sugeridos para Panel Web Cloud

Para que el panel web de todoenlocal.com pueda mostrar datos multi-caja:

### 6.1 Listar cajas de una sucursal

```
GET /api/v1/branches/:branchId/registers
```

Response:
```json
[
  {
    "id": "cloud-uuid",
    "name": "Caja 1",
    "series": "C1",
    "is_active": true,
    "current_shift": {
      "id": "...",
      "user_name": "Juan Perez",
      "opened_at": "2026-03-05T08:00:00Z",
      "total_sales": 3200.00,
      "transactions_count": 15
    }
  }
]
```

### 6.2 Dashboard multi-caja

```
GET /api/v1/branches/:branchId/registers/dashboard?date=2026-03-05
```

Response:
```json
{
  "date": "2026-03-05",
  "registers": [
    {
      "register_id": "...",
      "register_name": "Caja 1",
      "shifts_today": 2,
      "total_sales": 8500.00,
      "total_transactions": 42,
      "total_cash": 5200.00,
      "total_card": 2100.00,
      "total_transfer": 1200.00,
      "total_deposits": 1000.00,
      "total_withdrawals": 300.00,
      "closing_differences": -120.00
    }
  ],
  "totals": {
    "total_sales": 15200.00,
    "total_transactions": 78,
    "total_cash": 9800.00,
    "total_card": 3600.00,
    "total_transfer": 1800.00
  }
}
```

### 6.3 Historial de movimientos de caja

```
GET /api/v1/branches/:branchId/cash-movements?register_id=...&from=...&to=...
```

### 6.4 Historial de turnos por caja

```
GET /api/v1/branches/:branchId/shifts?register_id=...&from=...&to=...
```

---

## 7. Validaciones que Cloud debe hacer

### 7.1 En la validacion de licencia

- Si el plan incluye multicaja: retornar `"multicaja"` en addons y `max_registers > 1`
- Si el plan NO incluye multicaja: NO retornar `"multicaja"` en addons. `max_registers` puede ser 1 o ausente.

### 7.2 Al recibir un push con entity_type=register

- Validar que el numero de registros activos para ese branch no exceda `max_registers` de la licencia
- Si excede: rechazar con error descriptivo (el escritorio ya valida localmente, pero Cloud es la fuente de verdad)

### 7.3 Al recibir un push con entity_type=cash_movement

- Validar que el `shift_cloud_id` existe y pertenece al branch
- Validar que el `register_cloud_id` existe y esta activo
- Para transferencias: validar que ambos registros pertenecen al mismo branch

---

## 8. Orden de Implementacion Sugerido para Cloud

1. **Agregar addon y campo**: Incluir `"multicaja"` en addons y `max_registers` en el response de validacion de licencia
2. **Crear tablas**: `pos_registers`, `cash_movements`, y columnas nuevas en `cash_shifts`
3. **Procesar push**: Manejar los entity_types nuevos (`register`, `cash_movement`) y el `shift_close` extendido
4. **Retornar id_mappings**: Incluir cloud_ids de los nuevos registros en la respuesta del push
5. **Endpoints del panel**: Implementar los endpoints GET para visualizacion en el panel web
6. **Validaciones**: Agregar validaciones de max_registers y coherencia de datos

---

## 9. Notas Importantes

- **Retrocompatibilidad**: Los escritorios sin multicaja NO enviaran entity_type=register ni cash_movement. Los campos nuevos en shift_close pueden ser null/0 para escritorios antiguos.
- **Offline**: El escritorio puede operar offline. Los datos se encolan y se sincronizan cuando hay conexion. Cloud debe manejar datos que llegan fuera de orden cronologico.
- **Idempotencia**: Cada entidad tiene un `local_id` unico. Si Cloud recibe el mismo `local_id` dos veces, debe hacer upsert (no duplicar).
- **Zona horaria**: Todas las fechas se envian en ISO 8601 con timezone (UTC o con offset).
