# PLAN DE CORRECCIÓN - Auditoría enLocal Caja v1.5.4
**Fecha:** 2026-03-11
**Excluido:** Enviar más datos a cloud (requiere modificar endpoint cloud)

---

## FASE 1 — Bugs Críticos ✅ COMPLETADA

| # | Fix | Archivo | Estado |
|---|-----|---------|--------|
| 1.1 | `=` → `+=` en agregación de pagos del Corte Z | `packages/mod-pos/src/services/cashShifts.service.ts:219-221` | ✅ |
| 1.2 | SQL Injection: `customerId` parametrizado | `packages/mod-invoicing/src/services/invoices.service.ts:650` | ✅ |
| 1.3 | SQL Injection: `folioCol` + `config.id` parametrizado | `packages/mod-invoicing/src/services/fiscalConfig.service.ts:95` | ✅ |
| 1.4 | SQL Injection: `table` validado contra whitelist | `packages/mod-invoicing/src/services/invoices.service.ts:1050` | ✅ |
| 1.5 | Path traversal: `path.basename()` en backup delete | `apps/caja/electron/server/backup/backupRoutes.ts:107` | ✅ |
| 1.6 | CORS: `origin: '*'` → `localhost` only | `apps/caja/electron/server/index.ts:44` | ✅ |
| 1.7 | JWT secret: generar aleatorio si no hay env var | `packages/mod-config/src/services/auth.service.ts:6` | ✅ |

---

## FASE 2 — Validaciones de Lógica de Negocio ✅ COMPLETADA

| # | Fix | Archivo | Detalle | Estado |
|---|-----|---------|---------|--------|
| 2.1 | Devoluciones: validar cantidad vs items originales | `packages/mod-pos/src/services/returns.service.ts` | Consulta invoice_items + pos_return_items previos, valida qty <= disponible | ✅ |
| 2.2 | Devoluciones: prevenir devolución excesiva | `packages/mod-pos/src/services/returns.service.ts` | Suma qty ya devuelta por invoice_item, rechaza si excede original | ✅ |
| 2.3 | Movimientos de caja: rechazar montos negativos o cero | `packages/mod-pos/src/services/cashMovements.service.ts` | `if (data.amount <= 0) throw Error` en createMovement y createTransfer | ✅ |
| 2.4 | Transferencias: validar saldo en caja origen | `packages/mod-pos/src/services/cashMovements.service.ts` | Calcula opening + cash payments + deposits - withdrawals, rechaza si insuficiente | ✅ |
| 2.5 | Ventas: validar precio >= 0, descuento <= subtotal | `packages/mod-pos/src/routes/sales.routes.ts` | Valida price >= 0, discount >= 0, discount <= price*qty | ✅ |
| 2.6 | Inventario: prevenir stock negativo | `packages/mod-inventory/src/services/movements.service.ts` | Consulta current_stock antes de out, rechaza si insuficiente | ✅ |
| 2.7 | Redondeo financiero en entregas y remisiones | `delivery.service.ts` + `remission.service.ts` | Math.round(x * 100) / 100 en cada paso intermedio | ✅ |
| 2.8 | Crédito: incluir reembolsos en balance | `packages/mod-pos/src/services/credit.service.ts` | Removido filtro `p.amount > 0` para incluir refunds negativos | ✅ |

---

## FASE 3 — Seguridad & Electron ✅ COMPLETADA

| # | Fix | Archivo | Detalle | Estado |
|---|-----|---------|---------|--------|
| 3.1 | Handler `process.on('uncaughtException')` | `apps/caja/electron/main.ts` | Handlers globales para uncaughtException + unhandledRejection con log + dialog | ✅ |
| 3.2 | Handler `httpServer.on('error')` puerto ocupado | `apps/caja/electron/server/index.ts` | .on('error') con reject y mensaje EADDRINUSE claro | ✅ |
| 3.3 | Graceful shutdown await async | `apps/caja/electron/main.ts` | preventDefault + await backup + await pgManager.shutdown() + app.quit() | ✅ |
| 3.4 | Salt encriptación per-machine | `packages/core-license/src/storage.ts` | Salt derivado de hostname+username, fallback a legacy salt + re-encrypt | ✅ |
| 3.5 | PIN default: forzar cambio primer login | `server/index.ts` + `auth.service.ts` | Columna must_change_pin, flag en respuesta de login | ✅ |
| 3.6 | Rate limiting + anti-enumeración | `packages/mod-config/src/routes/auth.routes.ts` | Map de intentos por IP (5/min), error genérico para USER_NOT_FOUND+INVALID_PIN | ✅ |

---

## FASE 4 — Frontend & Sync ✅ COMPLETADA

| # | Fix | Archivo | Detalle | Estado |
|---|-----|---------|---------|--------|
| 4.1 | Modales: reset estado en onClose | `SuppliersPage.tsx` | Reset showCommercial en X y Cancelar | ✅ |
| 4.2 | Email: `type="email"` | `CustomersPage.tsx` | Ya tenía type="email" — falso positivo | ⏭️ |
| 4.3 | RFC: validación formato SAT | `CustomersPage.tsx:497` | pattern + title con regex SAT | ✅ |
| 4.4 | Inputs numéricos: min="0" | `PaymentComplementPage`, `CartaPortePage` | min="0" en montos, cantidades, peso, valor, distancia | ✅ |
| 4.5 | SalesPage: mostrar error | `SalesPage.tsx:383` | Ya existía error banner — falso positivo | ⏭️ |
| 4.6 | PriceListsPage: guardar `active` | `PriceListsPage.tsx:76` | Incluir active ?? true en body POST/PUT | ✅ |
| 4.7 | Sync fetch timeout 30s | `pullService.ts`, `pushService.ts` | AbortController con 30s timeout | ✅ |
| 4.8 | Pull transaction wrap | `pullService.ts:390+` | BEGIN/COMMIT/ROLLBACK envolviendo todos los upserts | ✅ |

---

## FASE 5 — Migraciones DB (CFDI prep) ✅ COMPLETADA

| # | Fix | Archivo | Detalle | Estado |
|---|-----|---------|---------|--------|
| 5.1 | Migración columnas invoices + invoice_items | `0021_cfdi_invoice_columns.sql` | ~40 columnas: receptor, tax breakdown, CFDI relations, timbrado, cancelación, global, carta porte, audit | ✅ |
| 5.2 | Migración tablas facturación | `0022_cfdi_invoicing_tables.sql` | fiscal_config, invoice_relations, invoice_payment_details, invoice_payment_related_docs, invoice_carta_porte (+locations, goods, operators), global_invoice_tickets | ✅ |
| 5.3 | Schema TS: payments, pos_returns, cash_shifts | `packages/core-db/src/schema/` | payments.ts, posReturns.ts, cashShifts.ts + barrel export | ✅ |
| 5.4 | Índices faltantes | `0023_add_missing_indexes.sql` | 13 índices: remissions, products, payments, cash_shifts, pos_returns, receivables, invoice_relations, payment_details, carta_porte | ✅ |
| 5.5 | _journal.json consistencia | `_journal.json` | 21 entries, todos con .sql correspondiente, sin huérfanos | ✅ |

---

## Archivos clave por fase

### Fase 1 (7 archivos):
- `packages/mod-pos/src/services/cashShifts.service.ts`
- `packages/mod-invoicing/src/services/invoices.service.ts`
- `packages/mod-invoicing/src/services/fiscalConfig.service.ts`
- `apps/caja/electron/server/backup/backupRoutes.ts`
- `apps/caja/electron/server/index.ts`
- `packages/mod-config/src/services/auth.service.ts`

### Fase 2 (7 archivos):
- `packages/mod-pos/src/services/returns.service.ts`
- `packages/mod-pos/src/services/cashMovements.service.ts`
- `packages/mod-pos/src/routes/sales.routes.ts`
- `packages/mod-inventory/src/services/movements.service.ts`
- `packages/mod-remissions/src/services/delivery.service.ts`
- `packages/mod-pos/src/services/credit.service.ts`

### Fase 3 (4 archivos):
- `apps/caja/electron/main.ts`
- `apps/caja/electron/server/index.ts`
- `packages/core-license/src/storage.ts`
- `packages/mod-config/src/routes/auth.routes.ts`

### Fase 4 (6+ archivos):
- `apps/caja/webapp/src/pages/CustomersPage.tsx`
- `apps/caja/webapp/src/pages/SalesPage.tsx`
- `apps/caja/webapp/src/pages/PriceListsPage.tsx`
- `packages/core-sync/src/pullService.ts`
- `packages/core-sync/src/pushService.ts`
- Todos los modales con forms
