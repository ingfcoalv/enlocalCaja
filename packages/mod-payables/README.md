# mod-payables — Módulo de Cuentas por Pagar

## 1. Visión General

Gestiona todo el ciclo de compras: órdenes de compra a proveedores, recepción de mercancía con verificación de almacén, registro de facturas de proveedor, programación y ejecución de pagos, y control de antigüedad de saldos por pagar.

Es el espejo de mod-remissions/CxC pero desde el lado del gasto.

### Dependencias

```
mod-payables
├── REQUIERE: mod-catalogs      (proveedores, productos)
├── REQUIERE: mod-inventory     (ingreso de stock al recibir mercancía)
├── SE INTEGRA: mod-invoicing   (registro de CFDI recibidos del proveedor)
├── SE INTEGRA: mod-reports     (reportes de CxP, flujo de efectivo)
└── SE INTEGRA: mod-pos         (afecta flujo de caja si se paga en efectivo)
```

### Distribución por App

| App | Disponibilidad |
|-----|---------------|
| enLocal ERP | ✅ Default (incluido) |
| enLocal Caja | 🔵 Addon |
| enLocal Facturación | 🔵 Addon |
| enLocal Servicios | 🔵 Addon |
| enLocal Nóminas | — No disponible |

---

## 2. Flujo General

```
COMPRADOR crea            ALMACENISTA recibe        ADMIN/CONTADOR paga
     │                          │                         │
     v                          v                         v
┌───────────┐   aprobar   ┌───────────┐  recibir   ┌───────────┐  registrar  ┌───────────┐
│  ORDEN DE │ ──────────> │  ORDEN    │ ────────> │ MERCANCÍA │ ─────────> │ FACTURA   │
│  COMPRA   │  (manager)  │ APROBADA  │  (almacén) │ RECIBIDA  │  (admin)   │ PROVEEDOR │
│  (draft)  │             │           │            │ +inventario│           │ registrada │
└───────────┘             └──────────┘            └───────────┘           └───────────┘
                                                                                │
                                                          programar pago        │
                                                                │               │
                                                                v               v
                                                          ┌───────────┐   ┌───────────┐
                                                          │  CUENTA   │   │  PAGO     │
                                                          │ POR PAGAR │──>│ EJECUTADO │
                                                          │ (CxP)     │   │           │
                                                          └───────────┘   └───────────┘
```

### Diferencia con CxC

| Concepto | CxC (Remisiones) | CxP (Compras) |
|----------|-------------------|---------------|
| Nosotros somos | El vendedor | El comprador |
| La contraparte es | El cliente | El proveedor |
| El documento es | Nota de remisión | Orden de compra |
| La mercancía | Sale del almacén | Entra al almacén |
| La factura | La emitimos nosotros | La recibimos del proveedor |
| El pago | Lo cobramos | Lo pagamos |
| El saldo | Nos deben | Debemos |

---

## 3. Roles y Permisos

```typescript
// Agregar a los permisos existentes

// Comprador/Operador
sales/operator: [
  // ... permisos existentes ...
  'purchase_orders.create',
  'purchase_orders.read',
  'purchase_orders.update',
  'purchase_orders.cancel',
]

// Almacenista
warehouse: [
  // ... permisos existentes ...
  'purchase_orders.read',
  'purchase_orders.receive',     // Recibir mercancía
  'purchase_returns.create',     // Devolver a proveedor
  'purchase_returns.process',
]

// Manager / Admin
manager/admin: [
  // ... permisos existentes ...
  'purchase_orders.*',
  'purchase_orders.approve',     // Aprobar órdenes de compra
  'payables.*',                  // Gestionar CxP completo
  'payables.pay',                // Ejecutar pagos
  'supplier_invoices.*',         // Registrar facturas de proveedor
]

// Cajero
cashier: [
  // ... permisos existentes ...
  'payables.read',
  'payables.pay',               // Ejecutar pagos desde caja
]

// Viewer
viewer: [
  // ... permisos existentes ...
  'purchase_orders.read',
  'payables.read',
  'supplier_invoices.read',
]
```

---

## 4. Flujo de Estados

### 4.1 Orden de Compra

```
COMPRADOR crea          MANAGER aprueba        ALMACENISTA recibe
     │                       │                       │
     v                       v                       v
┌─────────┐  aprobar  ┌──────────┐  recibir  ┌───────────────┐
│  DRAFT  │ ────────> │ APPROVED │ ────────> │   RECEIVED    │
│         │ (manager) │          │ (almacén) │ (+ inventario)│
└─────────┘           └──────────┘           └───────────────┘
     │                     │                       │
     │ cancelar            │ cancelar              │ recepción parcial
     v                     v                       v
┌───────────┐        ┌───────────┐         ┌────────────────┐
│ CANCELLED │        │ CANCELLED │         │PARTIAL_RECEIVED│
└───────────┘        └───────────┘         └────────────────┘
                                                   │
                                                   │ completar
                                                   v
                                            ┌───────────────┐
                                            │   RECEIVED    │
                                            └───────────────┘
```

### 4.2 Devolución a Proveedor

```
┌───────────┐  enviar   ┌──────────┐  proveedor acepta  ┌───────────┐
│ REQUESTED │ ────────> │   SENT   │ ────────────────> │ COMPLETED │
│           │ (almacén) │          │                    │(nota créd)│
└───────────┘           └──────────┘                    └───────────┘
     │                       │
     │ cancelar              │ proveedor rechaza
     v                       v
┌───────────┐          ┌──────────┐
│ CANCELLED │          │ REJECTED │
└───────────┘          └──────────┘
```

### 4.3 Cuenta por Pagar

```
┌─────────┐              ┌─────────┐              ┌──────┐
│ PENDING │ ──pago───> │ PARTIAL │ ──pago───> │ PAID │
│         │  parcial     │         │  total       │      │
└─────────┘              └─────────┘              └──────┘
     │                        │
     │ vence                  │ vence
     v                        v
┌─────────┐              ┌─────────┐
│ OVERDUE │ ──pago───> │  PAID   │
└─────────┘              └─────────┘
```

---

## 5. Schema de Base de Datos

### 5.1 Extensión de Proveedores — Perfil Comercial

```
Agregar a tabla suppliers existente:

payment_terms         text nullable              -- "Net 30", texto libre
default_credit_days   integer default 0          -- Días de crédito que nos da
default_payment_method text nullable             -- 'spei'|'check'|'cash'
bank_name             text nullable
bank_account          text nullable              -- Número de cuenta
bank_clabe            text nullable              -- CLABE interbancaria (18 dígitos)
bank_reference        text nullable              -- Referencia para pagos
contact_email         text nullable              -- Email para enviar OC
currency              text default 'MXN'
tax_rate              numeric(5,4) default '0.16'
balance               numeric(12,2) default '0'  -- Lo que les debemos (calculado)
```

### 5.2 Órdenes de Compra

```
purchase_orders:
  id                  uuid PK defaultRandom
  folio               integer notNull
  series              text default 'OC'
  supplier_id         uuid FK suppliers notNull
  supplier_name       text notNull                 -- snapshot
  supplier_rfc        text nullable                -- snapshot
  status              text default 'draft'         -- draft|approved|partial_received|received|cancelled
  payment_type        text default 'credit'        -- 'cash'|'credit'
  credit_days         integer nullable             -- heredado del proveedor
  expected_date       timestamp nullable           -- fecha esperada de entrega
  subtotal            numeric(12,2) default '0'
  discount_amount     numeric(12,2) default '0'
  discount_percent    numeric(5,2) default '0'
  tax_amount          numeric(12,2) default '0'
  total               numeric(12,2) default '0'
  currency            text default 'MXN'
  notes               text nullable
  internal_notes      text nullable
  delivery_address    text nullable                -- a dónde enviar
  -- Aprobación
  created_by          uuid notNull
  approved_by         uuid nullable
  approved_at         timestamp nullable
  cancelled_by        uuid nullable
  cancelled_at        timestamp nullable
  cancel_reason       text nullable
  -- Sync
  cloud_id            text nullable
  created_at          timestamp defaultNow
  updated_at          timestamp defaultNow

purchase_order_items:
  id                  uuid PK defaultRandom
  purchase_order_id   uuid FK purchase_orders notNull
  product_id          uuid FK products nullable    -- nullable si es producto nuevo
  product_name        text notNull
  product_sku         text nullable
  quantity            numeric(12,4) notNull
  unit_price          numeric(12,2) notNull
  discount            numeric(12,2) default '0'
  tax_rate            numeric(5,4) default '0.16'
  tax_amount          numeric(12,2) default '0'
  total               numeric(12,2) notNull
  quantity_received   numeric(12,4) default '0'
  quantity_returned   numeric(12,4) default '0'
  sat_code            text nullable
  sat_unit            text default 'E48'
  notes               text nullable
  sort_order          integer default 0
  created_at          timestamp defaultNow
```

### 5.3 Recepciones de Mercancía

```
purchase_receipts:
  id                  uuid PK defaultRandom
  purchase_order_id   uuid FK purchase_orders notNull
  folio               integer notNull
  series              text default 'REC'
  status              text default 'received'      -- received|cancelled
  received_by         uuid notNull                 -- almacenista
  received_at         timestamp defaultNow
  supplier_delivery_note text nullable             -- número de remisión del proveedor
  notes               text nullable
  cloud_id            text nullable
  created_at          timestamp defaultNow

purchase_receipt_items:
  id                  uuid PK defaultRandom
  receipt_id          uuid FK purchase_receipts notNull
  order_item_id       uuid FK purchase_order_items notNull
  product_id          uuid nullable
  product_name        text notNull
  quantity_received   numeric(12,4) notNull
  quantity_rejected   numeric(12,4) default '0'    -- rechazado por daño/error
  reject_reason       text nullable
  product_condition   text default 'good'          -- good|damaged|expired|wrong
  unit_cost           numeric(12,2) notNull        -- costo unitario para inventario
  inventory_movement_id uuid nullable              -- FK al movimiento de ingreso
  notes               text nullable
  created_at          timestamp defaultNow
```

### 5.4 Facturas de Proveedor

```
supplier_invoices:
  id                  uuid PK defaultRandom
  supplier_id         uuid FK suppliers notNull
  purchase_order_id   uuid FK purchase_orders nullable  -- puede no tener OC
  folio               text notNull                 -- folio de la factura del proveedor
  series              text nullable                -- serie del proveedor
  uuid_fiscal         text nullable                -- UUID del CFDI recibido
  type                text default 'I'             -- I=Ingreso, E=Egreso (nota crédito)
  status              text default 'registered'    -- registered|validated|paid|cancelled
  -- Montos
  subtotal            numeric(12,2) notNull
  tax_amount          numeric(12,2) default '0'
  retention_isr       numeric(12,2) default '0'    -- retención ISR (si aplica)
  retention_iva       numeric(12,2) default '0'    -- retención IVA (si aplica)
  total               numeric(12,2) notNull
  currency            text default 'MXN'
  exchange_rate       numeric(10,4) default '1'
  -- Pago
  payment_method      text nullable                -- PUE|PPD
  payment_form        text nullable                -- código SAT
  -- Fechas
  invoice_date        timestamp notNull            -- fecha de la factura
  due_date            timestamp nullable           -- vencimiento
  -- Archivos
  xml_content         text nullable                -- XML del CFDI recibido
  pdf_url             text nullable                -- ruta al PDF recibido
  -- Validación SAT
  sat_validation_status text nullable              -- valid|invalid|not_found|cancelled
  sat_validated_at    timestamp nullable
  -- Relaciones
  related_invoice_id  uuid nullable                -- para notas de crédito del proveedor
  -- Auditoría
  registered_by       uuid notNull
  notes               text nullable
  cloud_id            text nullable
  created_at          timestamp defaultNow
  updated_at          timestamp defaultNow

supplier_invoice_items:
  id                  uuid PK defaultRandom
  supplier_invoice_id uuid FK supplier_invoices notNull
  description         text notNull
  quantity            numeric(12,4) notNull
  unit_price          numeric(12,2) notNull
  amount              numeric(12,2) notNull
  discount            numeric(12,2) default '0'
  tax_rate            numeric(5,4) default '0.16'
  sat_code            text nullable
  sat_unit            text nullable
  product_id          uuid FK products nullable    -- mapear al producto local
  created_at          timestamp defaultNow
```

### 5.5 Cuentas por Pagar

```
payables:
  id                  uuid PK defaultRandom
  supplier_id         uuid FK suppliers notNull
  supplier_invoice_id uuid FK supplier_invoices nullable
  purchase_order_id   uuid FK purchase_orders nullable
  -- Montos
  original_amount     numeric(12,2) notNull
  adjustments         numeric(12,2) default '0'    -- notas de crédito, devoluciones
  amount_paid         numeric(12,2) default '0'
  balance             numeric(12,2) notNull        -- original - adjustments - paid
  -- Fechas
  issued_date         timestamp notNull
  due_date            timestamp notNull
  -- Estado
  status              text default 'pending'       -- pending|partial|paid|overdue|cancelled
  last_payment_date   timestamp nullable
  days_overdue        integer default 0
  -- Prioridad
  priority            text default 'normal'        -- low|normal|high|urgent
  -- Sync
  cloud_id            text nullable
  created_at          timestamp defaultNow
  updated_at          timestamp defaultNow

payable_payments:
  id                  uuid PK defaultRandom
  payable_id          uuid FK payables notNull
  amount              numeric(12,2) notNull
  payment_method      text notNull                 -- 'cash'|'spei'|'check'|'card'
  reference           text nullable                -- folio de transferencia, número de cheque
  bank_account        text nullable                -- desde qué cuenta se pagó
  -- Comprobante
  proof_url           text nullable                -- comprobante de pago (imagen/PDF)
  -- Auditoría
  paid_by             uuid notNull                 -- quién autorizó/ejecutó el pago
  authorized_by       uuid nullable                -- quién autorizó (si es diferente)
  notes               text nullable
  cloud_id            text nullable
  created_at          timestamp defaultNow
```

### 5.6 Devoluciones a Proveedor

```
purchase_returns:
  id                  uuid PK defaultRandom
  purchase_order_id   uuid FK purchase_orders notNull
  receipt_id          uuid FK purchase_receipts nullable
  folio               integer notNull
  series              text default 'DPR'           -- Devolución a Proveedor
  status              text default 'requested'     -- requested|sent|completed|rejected|cancelled
  return_type         text notNull                 -- 'full'|'partial'
  reason_category     text notNull                 -- 'defective'|'wrong_product'|'excess'|'expired'|'other'
  reason              text notNull
  total_returned      numeric(12,2) default '0'
  -- Flujo
  requested_by        uuid notNull
  requested_at        timestamp defaultNow
  sent_at             timestamp nullable           -- cuando se envió al proveedor
  completed_at        timestamp nullable
  supplier_credit_note text nullable               -- folio de nota de crédito del proveedor
  -- Ajustes
  payable_adjusted    boolean default false
  inventory_adjusted  boolean default false
  notes               text nullable
  cloud_id            text nullable
  created_at          timestamp defaultNow
  updated_at          timestamp defaultNow

purchase_return_items:
  id                  uuid PK defaultRandom
  return_id           uuid FK purchase_returns notNull
  order_item_id       uuid FK purchase_order_items notNull
  product_id          uuid nullable
  product_name        text notNull
  quantity_returned   numeric(12,4) notNull
  unit_cost           numeric(12,2) notNull
  total_refund        numeric(12,2) notNull
  product_condition   text nullable
  inventory_movement_id uuid nullable
  notes               text nullable
  created_at          timestamp defaultNow
```

### 5.7 Historial de Estados

```
purchase_order_status_history:
  id                  uuid PK defaultRandom
  purchase_order_id   uuid FK purchase_orders notNull
  from_status         text nullable
  to_status           text notNull
  changed_by          uuid notNull
  changed_by_name     text notNull
  changed_by_role     text notNull
  notes               text nullable
  created_at          timestamp defaultNow
```

---

## 6. API REST

### 6.1 Órdenes de Compra (`/api/purchase-orders`)

```
GET    /api/purchase-orders
       ?status=draft|approved|partial_received|received|cancelled
       ?supplier_id=uuid
       ?from=&to=
       ?q= (folio, proveedor)
       ?page=&limit=
       Permiso: purchase_orders.read

GET    /api/purchase-orders/:id
       Permiso: purchase_orders.read
       Response: orden con items[], receipts[], statusHistory[]

POST   /api/purchase-orders
       Permiso: purchase_orders.create
       Body: {
         supplier_id, payment_type, expected_date?, delivery_address?,
         notes?, internal_notes?,
         items: [{ product_id?, product_name, quantity, unit_price, discount?, notes? }]
       }
       - Snapshot del proveedor (nombre, RFC)
       - Si payment_type='credit': credit_days heredado del proveedor
       - Calcular totales
       Response 201: { order }

PUT    /api/purchase-orders/:id
       Permiso: purchase_orders.update
       Solo status=draft
       Body: campos a actualizar + items[]

POST   /api/purchase-orders/:id/approve
       Permiso: purchase_orders.approve
       Solo status=draft
       - Cambia a 'approved'
       - Registra approved_by, approved_at
       - Registra en statusHistory
       Response: { order }

POST   /api/purchase-orders/:id/cancel
       Permiso: purchase_orders.cancel
       Solo status=draft|approved
       Body: { reason }
       - Si había recepciones parciales: NO permitir cancelar (debe hacerse devolución)
       Response: { order }

GET    /api/purchase-orders/:id/pdf
       Permiso: purchase_orders.read
       PDF de la orden de compra con logo del negocio
       - Similar al PDF de remisión pero con datos del proveedor
       - Incluir: dirección de entrega, fecha esperada, condiciones de pago

POST   /api/purchase-orders/:id/send-email
       Permiso: purchase_orders.update
       Solo status=approved
       Envía la OC por email al proveedor (supplier.contact_email)
       Body: { message?: string }  -- mensaje adicional opcional
```

### 6.2 Recepción de Mercancía (`/api/purchase-receipts`)

```
GET    /api/purchase-orders/warehouse/pending
       Permiso: purchase_orders.receive
       Órdenes con status='approved' o 'partial_received'
       → Cola de trabajo del almacenista

POST   /api/purchase-orders/:id/receive
       Permiso: purchase_orders.receive
       Solo status=approved|partial_received
       Body: {
         supplier_delivery_note?: string,
         notes?: string,
         items: [{
           order_item_id: uuid,
           quantity_received: number,
           quantity_rejected?: number,
           reject_reason?: string,
           product_condition: 'good'|'damaged'|'expired'|'wrong',
           unit_cost?: number              -- si difiere del precio de la OC
         }]
       }
       Acciones:
         1. Crear purchase_receipt + items
         2. Actualizar quantity_received en purchase_order_items
         3. Por cada item recibido con condition='good':
            *** INGRESAR INVENTARIO ***
            stock_movement: type='in', reference='OC-{folio}', reference_type='purchase'
            Actualizar current_stock (sumar)
         4. Items rechazados: registrar pero NO ingresar a inventario
         5. Si todos los items completaron su quantity → status 'received'
            Si parcial → status 'partial_received'
         6. Registrar en statusHistory
       Response: { receipt, inventoryMovements[], order }

GET    /api/purchase-receipts
       ?purchase_order_id=uuid
       ?from=&to=
       Permiso: purchase_orders.read
       Historial de recepciones

GET    /api/purchase-receipts/:id
       Permiso: purchase_orders.read
```

### 6.3 Facturas de Proveedor (`/api/supplier-invoices`)

```
GET    /api/supplier-invoices
       ?supplier_id=uuid
       ?status=registered|validated|paid|cancelled
       ?from=&to=
       ?q= (folio, uuid, proveedor)
       ?page=&limit=
       Permiso: supplier_invoices.read

GET    /api/supplier-invoices/:id
       Permiso: supplier_invoices.read

POST   /api/supplier-invoices
       Permiso: supplier_invoices.create
       Body: {
         supplier_id, purchase_order_id?,
         folio, series?, uuid_fiscal?,
         type: 'I'|'E',
         subtotal, tax_amount, retention_isr?, retention_iva?, total,
         currency?, exchange_rate?,
         payment_method?, payment_form?,
         invoice_date, due_date?,
         xml_content?, notes?,
         items: [{ description, quantity, unit_price, amount, tax_rate?, product_id? }]
       }
       Acciones:
         1. Registrar factura
         2. Si type='I' y payment está pendiente:
            Crear registro en payables (cuenta por pagar)
            due_date = invoice_date + supplier.default_credit_days (o el indicado)
            Actualizar supplier.balance
         3. Si type='E' (nota de crédito del proveedor):
            Ajustar payable relacionado (adjustments += amount)
            Actualizar supplier.balance
         4. Si purchase_order_id: vincular
       Response 201: { invoice, payable? }

PUT    /api/supplier-invoices/:id
       Permiso: supplier_invoices.update
       Solo status=registered

POST   /api/supplier-invoices/:id/upload-xml
       Permiso: supplier_invoices.create
       Content-Type: multipart/form-data (archivo XML)
       Parsea el XML del CFDI y auto-rellena los campos:
       - uuid_fiscal, folio, series, subtotal, tax, total, items, etc.
       - Intenta matchear supplier por RFC
       Response: { invoice (auto-populated), matched_supplier? }

POST   /api/supplier-invoices/:id/validate-sat
       Permiso: supplier_invoices.update
       Consulta al SAT si el CFDI es válido (via servicio externo)
       Response: { status: 'valid'|'invalid'|'not_found'|'cancelled' }

POST   /api/supplier-invoices/:id/upload-pdf
       Permiso: supplier_invoices.update
       Content-Type: multipart/form-data (archivo PDF)
       Guarda el PDF del proveedor
```

### 6.4 Cuentas por Pagar (`/api/payables`)

```
GET    /api/payables
       ?supplier_id=uuid
       ?status=pending|partial|paid|overdue|cancelled
       ?priority=low|normal|high|urgent
       ?overdue_only=true
       ?from=&to= (por due_date)
       ?page=&limit=
       Permiso: payables.read

GET    /api/payables/:id
       Con payments[], supplier_invoice, purchase_order
       Permiso: payables.read

GET    /api/payables/supplier/:supplierId/statement
       Permiso: payables.read
       Estado de cuenta con el proveedor

GET    /api/payables/aging-report
       Permiso: reports.read
       ?as_of=date
       Antigüedad de saldos por proveedor:
       { suppliers: [{ supplier_id, name, current, 1-30, 31-60, 61-90, 90+, total }], totals }

GET    /api/payables/payment-schedule
       Permiso: payables.read
       ?from=&to=  (default: próximos 7 días)
       CxP que vencen en el período, para programar pagos
       Incluye: proveedor, monto, vencimiento, prioridad

GET    /api/payables/cash-flow-projection
       Permiso: reports.read
       ?days=30
       Proyección de pagos por día/semana:
       { periods: [{ date, total_due, suppliers_count }], grand_total }

POST   /api/payables/:id/pay
       Permiso: payables.pay
       Body: {
         amount: number,
         payment_method: 'cash'|'spei'|'check'|'card',
         reference?: string,
         bank_account?: string,
         proof_url?: string,
         authorized_pin?: string,         -- si el monto excede threshold
         notes?: string
       }
       Validaciones:
         - amount > 0 y amount <= balance
         - Si amount > threshold configurable (ej: $10,000): requerir authorized_pin
       Acciones:
         1. Crear payable_payment
         2. Actualizar payable: amount_paid += amount, balance -= amount
         3. Si balance = 0 → status 'paid'
         4. Si balance > 0 → status 'partial'
         5. Actualizar supplier.balance (recalcular)
         6. Registrar en change_journal
       Response: { payment, payable }

PUT    /api/payables/:id/priority
       Permiso: payables.pay
       Body: { priority: 'low'|'normal'|'high'|'urgent' }

GET    /api/payables/pending-by-method
       Permiso: payables.read
       Agrupa CxP pendientes por método de pago preferido del proveedor
       Útil para preparar lotes de pagos por SPEI, por cheque, etc.

POST   /api/payables/batch-pay
       Permiso: payables.pay
       Body: {
         payments: [{
           payable_id: uuid,
           amount: number,
           payment_method: string,
           reference?: string
         }],
         authorized_pin: string            -- requerido para pagos batch
       }
       Procesa múltiples pagos en una transacción
       Response: { processed: number, failed: number, results: [] }
```

### 6.5 Devoluciones a Proveedor (`/api/purchase-returns`)

```
POST   /api/purchase-returns
       Permiso: purchase_returns.create
       Body: {
         purchase_order_id, receipt_id?,
         return_type: 'full'|'partial',
         reason_category, reason,
         items: [{ order_item_id, quantity_returned, product_condition?, notes? }]
       }
       Validaciones:
         - quantity_returned <= quantity_received - quantity_returned (previas)
       Response 201: { return }

GET    /api/purchase-returns
       Filtros: status, supplier, dates
       Permiso: purchase_returns.read

POST   /api/purchase-returns/:id/send
       Permiso: purchase_returns.process
       Marca como enviada al proveedor
       *** DESCONTAR INVENTARIO *** (sale del almacén de vuelta al proveedor)
       stock_movement: type='out', reference='DPR-{folio}', reference_type='purchase_return'

POST   /api/purchase-returns/:id/complete
       Permiso: purchase_returns.process
       Body: { supplier_credit_note?: string }
       El proveedor aceptó la devolución
       - Si hay CxP: adjustments += total_returned, recalcular balance
       - Actualizar supplier.balance
       Response: { return, payableAdjustment? }

POST   /api/purchase-returns/:id/reject
       Permiso: purchase_returns.process
       El proveedor rechazó la devolución
       *** REINGRESAR INVENTARIO *** (nos quedamos con la mercancía)
       stock_movement: type='in', reference='DPR-{folio}-REINGRESO'
```

### 6.6 Configuración

```
GET    /api/settings/purchase-folio
PUT    /api/settings/purchase-folio
       { startingFolio: number }
       Para OC, REC, y DPR

GET    /api/settings/payment-threshold
PUT    /api/settings/payment-threshold
       { amount: number }
       Monto a partir del cual se requiere PIN de autorización para pagar
```

---

## 7. Cron Jobs

```typescript
// 1. Actualizar CxP vencidas (cada hora)
async function updateOverduePayables(db) {
  // UPDATE payables SET status='overdue', days_overdue=...
  // WHERE due_date < now() AND status IN ('pending', 'partial')
}

// 2. Alertas de pagos próximos (diario)
async function paymentAlerts(db) {
  // CxP que vencen en los próximos 3 días
  // Emitir notificación
}

// 3. Recalcular balances de proveedores (cada hora)
async function recalculateSupplierBalances(db) {
  // SUM(balance) de payables pendientes por proveedor
  // Actualizar supplier.balance
}
```

---

## 8. Socket Events

```typescript
// Órdenes de compra
io.emit('purchase_order:created', { order })
io.emit('purchase_order:approved', { order })
io.emit('purchase_order:received', { order, receipt, inventoryMovements })
io.emit('purchase_order:cancelled', { order, reason })

// Facturas de proveedor
io.emit('supplier_invoice:registered', { invoice, payable })
io.emit('supplier_invoice:validated', { invoice, satStatus })

// Pagos
io.emit('payable:payment', { payable, payment })
io.emit('payable:paid', { payable, supplier })
io.emit('payable:overdue', { payable, supplier })

// Devoluciones
io.emit('purchase_return:created', { return: returnData })
io.emit('purchase_return:completed', { return: returnData, payableAdjustment })
```

---

## 9. Reportes

```
GET /api/reports/payables/summary?from=&to=
    Total pagado en el período, por método de pago, por proveedor

GET /api/reports/payables/vs-receivables?from=&to=
    Comparativo CxP vs CxC: flujo neto de efectivo

GET /api/reports/purchases/by-supplier?from=&to=
    Compras por proveedor: monto, órdenes, productos top

GET /api/reports/purchases/by-product?from=&to=
    Productos más comprados, costo promedio, proveedores

GET /api/reports/payables/projection?days=30
    Proyección de pagos: cuánto se necesita pagar por día/semana
```
