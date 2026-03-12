# enLocal Suite — Fases de Desarrollo para Claude Code

> Cada fase es un prompt independiente para Claude Code.
> Al iniciar cada fase, pegar el prompt correspondiente.
> Cada fase asume que la anterior está completada.

---

## FASE 0 — Scaffolding del Monorepo

### Objetivo
Crear la estructura base del monorepo con Turborepo, configurar pnpm workspaces, TypeScript base, y scaffoldear todos los packages y apps vacíos.

### Prompt para Claude Code

```
Necesito que crees el monorepo base para enLocal Suite. Lee primero el archivo ARQUITECTURA-MASTER.md para contexto completo.

Crea la siguiente estructura:

1. Inicializa monorepo con pnpm + Turborepo:
   - package.json raíz con scripts: build, dev, test, lint, package
   - pnpm-workspace.yaml apuntando a packages/* y apps/*
   - turbo.json con pipeline: build (dependsOn: ^build), dev, test, package (dependsOn: build+test)
   - tsconfig.base.json con paths aliases para @enlocal/*

2. Scaffoldea estos packages (cada uno con package.json, tsconfig.json, src/index.ts):
   - packages/core-electron
   - packages/core-license
   - packages/core-updater
   - packages/core-db
   - packages/core-server
   - packages/core-sync
   - packages/core-printing
   - packages/react-hooks
   - packages/react-components

3. Scaffoldea estos módulos de negocio (cada uno con package.json, tsconfig.json, src/index.ts, src/routes/, src/services/):
   - packages/mod-config
   - packages/mod-catalogs
   - packages/mod-invoicing
   - packages/mod-payroll
   - packages/mod-pos
   - packages/mod-inventory
   - packages/mod-appointments
   - packages/mod-reports

4. Scaffoldea estas apps (cada una con electron/, webapp/, package.json, app.config.ts):
   - apps/facturacion (color: #2563eb azul, puerto: 9001, multiuser: false)
   - apps/nominas (color: #0891b2 cyan, puerto: 9002, multiuser: false)
   - apps/erp (color: #7c3aed púrpura, puerto: 9003, multiuser: true)
   - apps/servicios (color: #ea580c naranja, puerto: 9004, multiuser: true)
   - apps/caja (color: #16a34a verde, puerto: 9005, multiuser: false)

5. Cada app.config.ts debe tener: appId, appName, port, dbName, multiuser, modules (default y addons) según esta tabla:
   - facturacion: default=[mod-config, mod-catalogs, mod-invoicing, mod-reports], addons=[mod-inventory, mod-pos]
   - nominas: default=[mod-config, mod-catalogs, mod-payroll, mod-reports], addons=[mod-invoicing]
   - erp: default=[mod-config, mod-catalogs, mod-invoicing, mod-inventory, mod-pos, mod-payroll, mod-reports], addons=[mod-appointments]
   - servicios: default=[mod-config, mod-catalogs, mod-appointments, mod-invoicing, mod-reports], addons=[mod-inventory, mod-pos]
   - caja: default=[mod-config, mod-catalogs, mod-pos, mod-reports], addons=[mod-invoicing, mod-inventory]

6. Crea tools/scripts/create-app.ts y tools/scripts/create-module.ts como scripts utilitarios para scaffoldear nuevos apps/módulos.

7. Agrega .gitignore, .npmrc (shamefully-hoist=true), y README.md básico.

No implementes lógica todavía, solo la estructura. Todos los index.ts deben exportar un placeholder type o función vacía comentada indicando qué irá ahí.
```

---

## FASE 1 — Core DB (PostgreSQL + Drizzle ORM)

### Objetivo
Implementar la capa de base de datos compartida: conexión, schemas y sistema de migraciones.

### Prompt para Claude Code

```
Trabaja en packages/core-db. Lee ARQUITECTURA-MASTER.md sección "Estructura del Monorepo > core-db" para contexto.

1. Instala dependencias: drizzle-orm, drizzle-kit, pg, @types/pg

2. Implementa src/connection.ts:
   - Función createDbPool(config: { host, port, database, user, password }) que retorna un pool pg + instancia Drizzle
   - Defaults: host=localhost, port=5432, user=enlocal, password=enlocal
   - Incluir health check (SELECT 1)

3. Implementa los schemas Drizzle en src/schema/:
   
   a) users.ts - Tabla de usuarios/staff:
      - id (uuid PK), name, email, pin_hash, role (text), color, photo, active (boolean), created_at, updated_at
   
   b) roles.ts - Roles y permisos:
      - roles: id (uuid PK), name, permissions (jsonb), is_system (boolean), created_at
      - user_roles: id (uuid PK), user_id (FK users), role_id (FK roles)
   
   c) customers.ts - Catálogo de clientes:
      - id (uuid PK), name, phone, email, address, rfc, razon_social, regimen_fiscal, uso_cfdi (default 'G03'),
        codigo_postal, birthday, cloud_id, notes, active (boolean), created_at, updated_at
   
   d) products.ts - Catálogo de productos:
      - id (uuid PK), category_id (FK categories), name, description, price (numeric), sku, barcode,
        sat_code, sat_unit (default 'E48'), tax_rate (numeric default 0.16), active, cloud_id, created_at, updated_at
      - categories: id (uuid PK), name, sort_order (integer), parent_id (FK self-ref nullable), active, cloud_id, created_at, updated_at
   
   e) services.ts - Catálogo de servicios:
      - id (uuid PK), name, description, price (numeric), duration_minutes (integer),
        category_id (FK categories), sat_code, sat_unit, active, created_at, updated_at
   
   f) sections.ts - Catálogo de secciones (áreas, zonas, departamentos):
      - id (uuid PK), name, type (text: 'area'|'zone'|'department'), parent_id (FK self-ref), sort_order, active, created_at, updated_at
   
   g) suppliers.ts - Catálogo de proveedores:
      - id (uuid PK), name, rfc, contact_name, phone, email, address, notes, active, created_at, updated_at
   
   h) invoices.ts - Facturación CFDI:
      - invoices: id (uuid PK), series, folio (integer), customer_id (FK), type ('I'|'E'|'P'|'N'), 
        status ('draft'|'stamped'|'cancelled'), use_cfdi, payment_method, payment_form,
        subtotal (numeric), tax (numeric), total (numeric), currency (default 'MXN'),
        uuid_fiscal, xml_content (text), pdf_url, stamped_at, cancelled_at, cloud_id, created_at, updated_at
      - invoice_items: id (uuid PK), invoice_id (FK), description, quantity (numeric), unit_price (numeric),
        amount (numeric), discount (numeric default 0), product_id (FK nullable), service_id (FK nullable),
        sat_code, sat_unit, tax_rate (numeric)
   
   i) settings.ts - Configuración key-value:
      - id (serial PK), key (text unique), value (text), module (text), created_at, updated_at
   
   j) changeJournal.ts - Auditoría + sync:
      - id (bigserial PK), table_name, record_id, action ('INSERT'|'UPDATE'|'DELETE'),
        data (jsonb), user_id (text nullable), synced (boolean default false), created_at
   
   k) syncState.ts - Estado de sincronización:
      - id (serial PK), key (text unique), value (text), updated_at

4. Implementa src/migrator.ts:
   - Función runMigrations(db) que ejecuta migraciones pendientes usando drizzle-kit migrate
   - Lee migrations/ folder

5. Exporta todo desde src/index.ts:
   - createDbPool, todos los schemas, runMigrations

6. Genera la primera migración con drizzle-kit generate

7. Agrega tests básicos con vitest: conexión, insert/select en cada tabla principal
```

---

## FASE 2 — Core License (Sistema de Licenciamiento)

### Objetivo
Implementar el sistema completo de licencias: fingerprint, archivo cifrado, validación online/offline, acceso a módulos.

### Prompt para Claude Code

```
Trabaja en packages/core-license. Lee ARQUITECTURA-MASTER.md sección 3 "Sistema de Licenciamiento" completa para contexto.

1. Instala dependencias: node-machine-id, crypto (builtin), fs, path

2. Implementa src/types.ts:
   - LicenseFile interface (installationHash, fingerprint, licenseKey, appId, plan, expiresAt, modules[], addons[], businessId, branchId, terminalId, lastCloudValidation, serverSignature)
   - ValidationResult interface (valid, plan, expiresAt, modules[], addons[], daysRemaining, showExpiryAlert, reason?)
   - ActivationResult interface (installationHash, plan, expiresAt, modules[], addons[], businessId, branchId, terminalId, token, signature)
   - HardwareDetails interface (machineId, hostname, platform, cpuModel, cpuCores, totalMemory, macAddress, diskSerial)

3. Implementa src/fingerprint.ts:
   - getHardwareDetails(): HardwareDetails — recopilar info de hardware
   - generateFingerprint(): string — SHA256 de machineId|macAddress|diskSerial|hostname
   - Manejar Windows vs Linux vs Mac para obtener disk serial (wmic en Win, lsblk en Linux)

4. Implementa src/storage.ts:
   - Cifrado AES-256-GCM con clave derivada del fingerprint via PBKDF2
   - saveLicenseFile(data: LicenseFile, fingerprint: string): void
   - readLicenseFile(fingerprint: string): LicenseFile | null
   - deleteLicenseFile(): void
   - El archivo se guarda en userData/.enlocal-license
   - Si el archivo se copia a otra máquina, NO se puede descifrar (diferente fingerprint = diferente key)

5. Implementa src/validator.ts:
   - activateLicense(config): Promise<ActivationResult>
     - Envía POST a {cloudApiUrl}/api/v1/licenses/activate con { serial, fingerprint, hardware, appId }
     - Guarda respuesta en archivo cifrado
     - Retorna resultado
   
   - validateLicense(config): Promise<ValidationResult>
     - Lee archivo cifrado
     - Verifica fingerprint coincida
     - Intenta validación online: POST a {cloudApiUrl}/api/v1/licenses/validate
     - Si servidor dice revocado → borrar archivo local, retornar invalid
     - Si online OK → actualizar archivo local con datos frescos
     - Si offline → verificar que lastCloudValidation < 7 días y expiresAt > now
     - Calcular daysRemaining y showExpiryAlert (<=5 días)

6. Implementa src/moduleAccess.ts:
   - SOFTWARE_MODULES: Record de appId → { default: string[], addons: string[] } para las 5 apps
   - getEnabledModules(appId, plan, addons[]): string[]
   - hasModuleAccess(enabledModules[], requiredModule): boolean

7. Implementa src/alerts.ts:
   - checkAndShowExpiryAlert(license: ValidationResult, win: BrowserWindow): void
   - Muestra Notification nativa del OS si daysRemaining <= 5
   - Envía IPC 'license:expiry-warning' al renderer

8. Exporta todo desde src/index.ts

9. Agrega tests con vitest:
   - Test fingerprint genera hash consistente
   - Test storage: guardar y leer archivo cifrado
   - Test storage: archivo no se puede leer con fingerprint diferente
   - Test moduleAccess: retorna módulos correctos por app
   - Test validator: validación offline funciona con datos en caché
```

---

## FASE 3 — Core Server + Core Electron

### Objetivo
Implementar el servidor Express base y el shell Electron reutilizable.

### Prompt para Claude Code

```
Trabaja en packages/core-server y packages/core-electron. Lee ARQUITECTURA-MASTER.md secciones 4 y 5.

=== CORE SERVER ===

1. Instala en core-server: express, socket.io, jsonwebtoken, bcryptjs, zod, cors, @types/*

2. Implementa src/createServer.ts:
   - createBaseServer(config: { db, enabledModules? }): { app, io, httpServer }
   - Middleware stack: json (10mb limit), cors(*), error handler
   - Inyecta db y io en app.settings
   - Inyecta enabledModules en app.settings

3. Implementa src/middleware/auth.ts:
   - authMiddleware: Lee Bearer token, verifica JWT, inyecta req.user
   - 401 si ausente o inválido
   - JWT secret configurable, default 'enlocal-suite-jwt-secret'

4. Implementa src/middleware/permissions.ts:
   - requirePermission(permission: string): middleware
   - Mapa de roles basado en Comanda Pro pero genérico:
     - owner/admin: ['*']
     - manager: acceso a todo menos settings sensibles
     - operator: acceso a operaciones del día a día (CRUD de entidades)
     - viewer: solo lectura
   - Wildcard matching: 'orders.*' matchea 'orders.create'

5. Implementa src/middleware/moduleGuard.ts:
   - moduleGuard(moduleName: string): middleware
   - Lee enabledModules de app.settings
   - 403 con { error: 'MODULE_NOT_LICENSED', module: moduleName } si no está habilitado

6. Implementa src/middleware/errorHandler.ts:
   - Catch-all error handler
   - Formato: { error: string, message: string, statusCode: number }

7. Implementa src/realtime/socketHandler.ts:
   - setupSocketHandlers(io): void
   - Auth en handshake via token
   - Track de dispositivos conectados

=== CORE ELECTRON ===

8. Instala en core-electron: electron (dev), qrcode, conf

9. Implementa src/createApp.ts:
   - createEnLocalApp(config): void
   - Config: appId, appName, port, multiuser, theme (primaryColor, icon), onReady callback
   - app.whenReady → setupIPC → createWindow → tray → onReady callback
   - BrowserWindow: 1200x800, frame: true, webPreferences con preload

10. Implementa src/windowManager.ts:
    - createMainWindow(config): BrowserWindow
    - Tamaño, icono, title según config

11. Implementa src/tray.ts:
    - createTray(config, callbacks): Tray
    - Menu: Abrir, Estado del servidor, Sincronizar, Salir
    - Colores: verde (OK), amarillo (licencia por vencer), rojo (error)

12. Implementa src/qrAccess.ts:
    - getLocalIP(): string
    - generateAccessQR(port): Promise<string> (data URL)
    - Solo se usa cuando config.multiuser === true

13. Implementa src/ipc/:
    - serverHandlers.ts: get-server-info, restart-server
    - licenseHandlers.ts: activate-license, get-license-info, get-module-access
    - updateHandlers.ts: check-update, install-update (delegado a core-updater)

14. Exporta todo desde src/index.ts
```

---

## FASE 4 — Core Updater + Core Sync

### Objetivo
Implementar auto-actualizaciones con backup y el motor de sincronización con la nube.

### Prompt para Claude Code

```
Trabaja en packages/core-updater y packages/core-sync. Lee ARQUITECTURA-MASTER.md secciones 6 y el concepto de sync.

=== CORE UPDATER ===

1. Instala en core-updater: electron-updater

2. Implementa src/updater.ts:
   - setupAutoUpdate(config: { dbName, currentVersion, updateServer? })
   - autoDownload = true, autoInstallOnAppQuit = false
   - Chequeo al inicio + cada 4 horas
   - on 'update-downloaded': mostrar dialog al usuario preguntando si desea actualizar
   - Si acepta: backup → quitAndInstall
   - Si rechaza: no hacer nada, preguntar de nuevo en 4h

3. Implementa src/backup.ts:
   - backupPostgres(dbName): Promise<string> — ejecuta pg_dump, retorna path del backup
   - restorePostgres(dbName, backupPath): Promise<void> — ejecuta pg_restore
   - cleanOldBackups(dir, keepCount=5): void — mantiene solo los últimos N backups
   - Los backups van en: userData/backups/

4. Implementa src/healthCheck.ts:
   - postUpdateHealthCheck(db): Promise<boolean>
   - Verifica: DB responde (SELECT 1), migraciones aplicadas, tablas críticas existen
   - Si falla: ofrece restaurar backup

5. Implementa src/channels.ts:
   - setUpdateChannel(channel: 'beta' | 'latest'): void
   - Canal configurable para testing interno vs producción

=== CORE SYNC ===

6. Instala en core-sync: ws (WebSocket client)

7. Implementa src/syncEngine.ts:
   - SyncEngine class con: start(), stop(), sync(), getStatus()
   - Config: apiUrl, authToken, appId, syncIntervalMs (default 5min), tables[]
   - Ciclo: pullCatalogs → pushOperations cada N segundos
   - Manejo de "sin internet" graceful

8. Implementa src/pullService.ts:
   - pullFromCloud(db, config): Promise<PullResult>
   - GET {apiUrl}/sync/pull?since={lastPull}&tables={tables}
   - Upsert en PostgreSQL local por cloud_id
   - Catalogs: clientes, productos, categorías, servicios, proveedores

9. Implementa src/pushService.ts:
   - pushToCloud(db, config): Promise<PushResult>
   - Lee change_journal con synced=false
   - POST {apiUrl}/sync/push con los cambios
   - Marca como synced=true al confirmar
   - Operaciones: ventas, facturas, movimientos de inventario

10. Implementa src/wsClient.ts:
    - connectWs(config, db, callbacks): WebSocket
    - Conecta a wss://todoenlocal.com/api/v1/sync/ws/{branchId}
    - Eventos recibidos: catalog_update, license_update, notification
    - Reconexión automática con backoff exponencial

11. Exporta todo
```

---

## FASE 5 — Módulos de Negocio: mod-config + mod-catalogs

### Objetivo
Implementar los dos módulos base que usan TODAS las apps.

### Prompt para Claude Code

```
Trabaja en packages/mod-config y packages/mod-catalogs. Lee ARQUITECTURA-MASTER.md y la documentación de Comanda Pro adjunta como referencia de API patterns.

=== MOD-CONFIG (Configuración, Usuarios, Roles) ===

1. Instala en mod-config: zod, bcryptjs, uuid

2. Implementa src/routes/auth.routes.ts:
   - POST /auth/login (público): recibe { pin, user_id? }, retorna { token, user }
   - POST /auth/logout: invalida sesión
   - POST /auth/refresh: renueva JWT
   - GET /auth/staff-list (público): lista usuarios para login
   - GET /auth/me: usuario actual

3. Implementa src/routes/users.routes.ts:
   - CRUD completo de usuarios
   - GET / (con filtros: ?active=1&role=X&q=search)
   - POST / (name, role, pin, color)
   - PUT /:id (actualizar datos)
   - PUT /:id/pin (cambiar PIN)
   - PUT /me/pin (cambiar mi propio PIN)
   - DELETE /:id (soft delete)

4. Implementa src/routes/roles.routes.ts:
   - CRUD de roles custom
   - GET / — lista roles (system + custom)
   - POST / — crear rol con array de permisos
   - PUT /:id — editar permisos
   - DELETE /:id — solo roles no-system

5. Implementa src/routes/settings.routes.ts:
   - GET / — todas las settings (filtrable por ?module=X)
   - GET /:key — setting individual
   - PUT /:key — actualizar setting
   - POST /bulk — actualizar múltiples settings

6. Implementa servicios correspondientes en src/services/
   - Usar schemas de @enlocal/core-db
   - Registrar cambios en change_journal

7. Implementa src/index.ts:
   - mountConfigRoutes(app, db): monta todas las rutas bajo /api

=== MOD-CATALOGS (Productos, Servicios, Clientes, Proveedores, Secciones) ===

8. Implementa src/routes/products.routes.ts (basado en Comanda Pro):
   - GET /products (filtros: ?category_id, ?active, ?q, ?page, ?limit)
   - POST /products
   - PUT /products/:id
   - DELETE /products/:id (soft delete)
   - POST /products/bulk (importación masiva)

9. Implementa src/routes/categories.routes.ts:
   - CRUD completo con sort_order
   - Soporte para categorías jerárquicas (parent_id)

10. Implementa src/routes/services.routes.ts:
    - CRUD similar a products pero con duration_minutes

11. Implementa src/routes/customers.routes.ts (basado en Comanda Pro):
    - CRUD completo con datos fiscales (rfc, razon_social, regimen_fiscal, uso_cfdi, codigo_postal)
    - GET /customers/birthdays?days=30
    - GET /customers/:id/stats (total_orders, total_spent, avg_ticket)
    - Búsqueda por ?q= en name, phone, email, rfc

12. Implementa src/routes/suppliers.routes.ts:
    - CRUD estándar

13. Implementa src/routes/sections.routes.ts:
    - CRUD con type ('area'|'zone'|'department') y parent_id

14. Todos los servicios deben:
    - Usar Drizzle para queries
    - Registrar en change_journal
    - Validar con zod
    - Paginación estándar: { data: [], total, page, pages }

15. Implementa src/index.ts:
    - mountCatalogRoutes(app, db): monta todo bajo /api
```

---

## FASE 6 — Módulos de Negocio: mod-invoicing + mod-pos

### Prompt para Claude Code

```
Trabaja en packages/mod-invoicing y packages/mod-pos. Lee ARQUITECTURA-MASTER.md y Comanda Pro docs como referencia.

=== MOD-INVOICING (Facturación CFDI) ===

1. Implementa src/routes/invoices.routes.ts:
   - GET /invoices (filtros: ?status, ?customer_id, ?from, ?to, ?type, ?q, paginación)
   - GET /invoices/:id (incluye items)
   - POST /invoices (crear borrador)
   - PUT /invoices/:id (editar borrador)
   - DELETE /invoices/:id (solo borradores)

2. Implementa src/routes/cfdi.routes.ts:
   - POST /invoices/:id/stamp — timbrar factura (cambia status a 'stamped')
   - POST /invoices/:id/cancel — cancelar factura
   - GET /invoices/:id/xml — descargar XML
   - GET /invoices/:id/pdf — descargar PDF

3. Implementa src/routes/fiscalData.routes.ts:
   - GET /fiscal/regimens — catálogo de regímenes fiscales
   - GET /fiscal/cfdi-uses — catálogo de usos CFDI
   - GET /fiscal/payment-forms — formas de pago SAT
   - GET /fiscal/payment-methods — métodos de pago SAT

4. Implementa src/services/cfdiBuilder.ts:
   - buildCFDI40(invoice, items, emisor, receptor): string (XML)
   - Generar XML CFDI 4.0 válido
   - Por ahora placeholder para conexión a PAC (timbrado real se implementará después)

5. Implementa src/services/pacService.ts:
   - Interface PAC con métodos: stamp(xml), cancel(uuid), getStatus(uuid)
   - Implementación mock por ahora
   - Estructura lista para conectar a Finkok, Digicraft, etc.

6. Implementa src/services/pdfGenerator.ts:
   - generateInvoicePDF(invoice): Buffer
   - Usar pdfkit o html-pdf para generar PDF de la factura

=== MOD-POS (Punto de Venta) ===

7. Implementa src/routes/sales.routes.ts:
   - GET /sales (filtros: ?from, ?to, ?status, ?method, ?q, paginación)
   - GET /sales/dashboard?date= (resumen: total, orders, avg_ticket, by_method, by_hour, top_products)
   - GET /sales/summary?from=&to= (resumen de período)

8. Implementa src/routes/cashShifts.routes.ts (basado en Comanda Pro):
   - GET /shifts/current
   - POST /shifts/open { opening_amount }
   - POST /shifts/close { closing_amount, notes }
   - GET /shifts/history (paginado)

9. Implementa src/routes/payments.routes.ts:
   - POST /payments { order_id, payments: [{ method, amount, reference, tip }] }
   - POST /payments/:id/refund { amount, reason }
   - Métodos: cash, card, transfer, credit

10. Implementa src/routes/receipts.routes.ts:
    - POST /receipts/:orderId/print — imprimir ticket
    - POST /receipts/:orderId/reprint
    - GET /receipts/:orderId/preview — preview en pantalla

11. mountPosRoutes y mountInvoicingRoutes exportados desde index.ts
```

---

## FASE 7 — Módulos Restantes: mod-payroll, mod-inventory, mod-appointments, mod-reports

### Prompt para Claude Code

```
Trabaja en packages/mod-payroll, mod-inventory, mod-appointments, mod-reports.

=== MOD-PAYROLL (Nómina) ===

1. Schemas adicionales necesarios (agregar a core-db si no existen):
   - employees: id, user_id (FK), curp, nss, rfc, salary_type ('fixed'|'hourly'), salary_amount, bank, clabe, department, hire_date, active
   - payroll_periods: id, name, start_date, end_date, type ('weekly'|'biweekly'|'monthly'), status ('draft'|'calculated'|'paid')
   - payroll_entries: id, period_id (FK), employee_id (FK), base_salary, deductions (jsonb), perceptions (jsonb), net_pay, cfdi_id (FK nullable)

2. Routes:
   - CRUD employees
   - CRUD payroll_periods
   - POST /payroll/:periodId/calculate — calcular nómina del período
   - POST /payroll/:periodId/approve — aprobar para pago
   - GET /payroll/:periodId/entries — detalle por empleado
   - POST /payroll/:periodId/stamp — timbrar recibos de nómina (usa mod-invoicing)

=== MOD-INVENTORY ===

3. Schemas adicionales:
   - ingredients: id, name, unit, current_stock (numeric), min_stock (numeric), cost (numeric), supplier_id (FK nullable)
   - stock_movements: id, ingredient_id (FK), type ('in'|'out'|'adjustment'), quantity, reference, notes, user_id, created_at
   - recipes: id, product_id (FK), ingredient_id (FK), quantity (numeric)

4. Routes (basado en Comanda Pro):
   - CRUD ingredients
   - GET/PUT recipes por producto
   - POST /movements { ingredient_id, type, quantity, notes }
   - GET /alerts — ingredientes bajo min_stock
   - GET /valuation — valor total del inventario

=== MOD-APPOINTMENTS (Citas/Agenda) ===

5. Schemas:
   - appointments: id, customer_id (FK), service_id (FK), staff_id (FK), date, start_time, end_time, status ('scheduled'|'confirmed'|'in_progress'|'completed'|'cancelled'|'no_show'), notes, created_at
   - schedules: id, staff_id (FK), day_of_week (0-6), start_time, end_time, active

6. Routes:
   - CRUD appointments (con filtros por fecha, staff, customer, status)
   - GET /appointments/calendar?from=&to=&staff_id= — vista calendario
   - GET /appointments/availability?date=&service_id= — slots disponibles
   - CRUD schedules (horarios del personal)

=== MOD-REPORTS ===

7. Routes:
   - GET /reports/dashboard — KPIs generales (ventas, clientes nuevos, facturas emitidas)
   - GET /reports/sales?from=&to=&group_by=(day|week|month) — reporte de ventas
   - GET /reports/products?from=&to= — productos más vendidos
   - GET /reports/customers?from=&to= — análisis de clientes
   - GET /reports/audit?from=&to=&table=&action= — log de auditoría (change_journal)
   - GET /reports/taxes?from=&to= — resumen fiscal (IVA, retenciones)

8. Todos los módulos exportan su mountXxxRoutes desde index.ts
```

---

## FASE 8 — React Hooks + Components Compartidos

### Prompt para Claude Code

```
Trabaja en packages/react-hooks y packages/react-components.

=== REACT HOOKS ===

1. Instala: axios, socket.io-client, zustand

2. Implementa src/useAuth.ts:
   - Estado: user, token, isAuthenticated, loading
   - Acciones: login(pin, userId?), logout(), refresh()
   - Persistencia en localStorage
   - Interceptor axios con Bearer token

3. Implementa src/useCRUD.ts:
   - Hook genérico: useCRUD<T>(basePath: string)
   - Retorna: { items, loading, error, fetchAll(filters?), getById(id), create(data), update(id, data), remove(id), pagination }
   - Soporte de paginación: page, limit, total, pages

4. Implementa src/useSocket.ts:
   - connectSocket(token, serverUrl?), disconnectSocket(), getSocket()
   - Estado de conexión: connected, reconnecting, disconnected
   - Auto-reconnect

5. Implementa src/useConnection.ts:
   - Estado: online/offline
   - Detecta conexión a internet y al servidor local

6. Implementa src/useLicense.ts:
   - Consulta IPC get-license-info
   - Estado: plan, expiresAt, daysRemaining, modules, addons

7. Implementa src/useModuleAccess.ts:
   - useModuleAccess(moduleName): { hasAccess, isAddon }
   - Lee módulos habilitados desde contexto/IPC

8. Implementa src/useToast.ts:
   - Store Zustand: toasts[]
   - Acciones: success(msg), error(msg), warning(msg), info(msg), removeToast(id)

=== REACT COMPONENTS ===

9. Instala: tailwindcss (peer), lucide-react

10. Implementa src/LicenseAlert.tsx:
    - Escucha IPC 'license:expiry-warning'
    - Banner amarillo: "Tu licencia vence en X días (fecha). Renueva en todoenlocal.com"
    - Botón "Descartar" que oculta el banner hasta el siguiente inicio

11. Implementa src/UpdatePrompt.tsx:
    - Escucha IPC 'update:available'
    - Modal: "Nueva versión X disponible. Se respaldará tu base de datos. ¿Actualizar ahora?"
    - Botones: "Actualizar ahora" | "Después"

12. Implementa src/QRAccessPanel.tsx:
    - Muestra QR con la URL de acceso LAN
    - Muestra IP y puerto: "Otros dispositivos pueden acceder en: http://192.168.1.X:9003"
    - Solo visible cuando config.multiuser === true

13. Implementa src/ModuleGate.tsx:
    - Props: module (string), children, fallback?
    - Si tiene acceso: renderiza children
    - Si es addon sin comprar: renderiza fallback (o null)
    - Usa useModuleAccess internamente

14. Implementa src/LoginScreen.tsx:
    - Lista de usuarios con avatar/color
    - Input de PIN (4-6 dígitos)
    - Botón login
    - Usa useAuth hook
    - Acepta prop className para theming

15. Implementa src/ActivationScreen.tsx:
    - Input para serial de licencia (TEL-XXXXX-XXXXX-XXXXX)
    - Botón "Activar"
    - Muestra fingerprint para referencia
    - Mensajes de error descriptivos

16. Exporta todo
```

---

## FASE 9 — Primera App Completa: enLocal Caja

### Objetivo
Ensamblar la primera app funcional end-to-end para validar toda la arquitectura.

### Prompt para Claude Code

```
Trabaja en apps/caja. Esta es la primera app completa para validar la arquitectura. Lee ARQUITECTURA-MASTER.md y app.config.ts de caja.

enLocal Caja es un punto de venta retail (no restaurante). Color: verde (#16a34a). Puerto: 9005. No multi-usuario.
Módulos default: mod-config, mod-catalogs, mod-pos, mod-reports
Addons opcionales: mod-invoicing, mod-inventory

=== ELECTRON ===

1. Implementa electron/main.ts:
   - Importa createEnLocalApp de @enlocal/core-electron
   - Importa validateLicense de @enlocal/core-license
   - Importa setupAutoUpdate de @enlocal/core-updater
   - Flujo: validateLicense → si válida: startServer → loadURL, si no: pantalla activación
   - Configura IPC handlers para licencia y servidor

2. Implementa electron/server/index.ts:
   - Crea pool PostgreSQL (enlocal_caja)
   - Ejecuta migraciones
   - Monta módulos según enabledModules:
     - Siempre: mod-config (/api), mod-catalogs (/api), mod-pos (/api), mod-reports (/api)
     - Si addon: mod-invoicing (/api), mod-inventory (/api)
   - Express.static para webapp
   - Escucha en 127.0.0.1:9005

3. Configura electron-builder.yml:
   - appId: com.todoenlocal.caja
   - productName: enLocal Caja
   - NSIS installer
   - Auto-update config

=== WEBAPP (React UI) ===

4. Setup webapp con Vite + React + TypeScript + Tailwind:
   - Paleta verde en tailwind.config.js
   - Proxy a localhost:9005 en dev

5. Implementa pages:
   - /login → LoginScreen (de react-components, con theme verde)
   - /activation → ActivationScreen
   - / → Dashboard principal (resumen de ventas del día)
   - /pos → Pantalla de venta (grid de productos, carrito, cobro)
   - /products → Catálogo de productos (CRUD)
   - /customers → Catálogo de clientes (CRUD)
   - /sales → Historial de ventas
   - /reports → Reportes y dashboard
   - /settings → Configuración general
   - /settings/users → Gestión de usuarios

6. La pantalla /pos debe incluir:
   - Grid de categorías + productos a la izquierda
   - Carrito/ticket a la derecha
   - Búsqueda rápida de productos
   - Selector de cliente
   - Botones de método de pago (efectivo, tarjeta, transferencia)
   - Cálculo de cambio para efectivo
   - Apertura/cierre de turno de caja

7. Usa ModuleGate para secciones de addons:
   - Inventario: <ModuleGate module="mod-inventory"><InventorySection /></ModuleGate>
   - Facturación: <ModuleGate module="mod-invoicing"><InvoiceButton /></ModuleGate>

8. Integra LicenseAlert y UpdatePrompt en el layout principal

9. Implementa stores Zustand específicos de Caja:
   - useCartStore (items, addItem, removeItem, clear, totals)
   - usePosStore (currentShift, openShift, closeShift)

10. Verifica que todo compile y funcione end-to-end:
    - Activar licencia (mock server si no hay backend real)
    - Login con PIN
    - CRUD productos
    - Crear venta
    - Ver reportes
```

---

## FASE 10 — Apps Restantes (Facturación, Nóminas, ERP, Servicios)

### Prompt para Claude Code

```
Con la app Caja como referencia funcional, crea las 4 apps restantes. Cada una tiene su propia UI/tema pero reutiliza los packages compartidos.

=== enLocal Facturación (apps/facturacion) ===
- Color: azul (#2563eb), puerto 9001, no multiusuario
- Módulos: mod-config, mod-catalogs, mod-invoicing, mod-reports + addons: mod-inventory, mod-pos
- Páginas principales: Dashboard, Facturas (lista+crear+timbrar), Clientes, Productos, Reportes fiscales
- Foco: workflow de facturación CFDI (borrador → timbrar → cancelar)

=== enLocal Nóminas (apps/nominas) ===
- Color: cyan (#0891b2), puerto 9002, no multiusuario
- Módulos: mod-config, mod-catalogs, mod-payroll, mod-reports + addons: mod-invoicing
- Páginas: Dashboard, Empleados, Períodos de nómina, Calcular nómina, Recibos, Reportes
- Foco: gestión de empleados y cálculo de nómina

=== enLocal ERP (apps/erp) ===
- Color: púrpura (#7c3aed), puerto 9003, SÍ multiusuario (QR)
- Módulos: TODOS los default + addon: mod-appointments
- Páginas: Dashboard, Productos, Servicios, Clientes, Proveedores, Inventario, Facturación, Nómina, POS, Reportes, Config
- Es la app más completa. El sidebar debe mostrar todos los módulos habilitados.
- Incluir QRAccessPanel en settings para que otros equipos se conecten

=== enLocal Servicios (apps/servicios) ===
- Color: naranja (#ea580c), puerto 9004, SÍ multiusuario (QR)
- Módulos: mod-config, mod-catalogs, mod-appointments, mod-invoicing, mod-reports + addons: mod-inventory, mod-pos
- Páginas: Dashboard, Agenda/Calendario, Citas, Servicios, Clientes, Facturación, Reportes
- Foco: vista de calendario con citas y agenda del personal

Para cada app:
1. Copia la estructura de Caja como template
2. Ajusta app.config.ts con los datos correctos
3. Ajusta tailwind.config.js con la paleta de colores
4. Ajusta electron/server/index.ts montando solo los módulos que corresponden
5. Crea las páginas específicas de cada app
6. Aplica ModuleGate para secciones de addons
7. Configura electron-builder.yml
```

---

## FASE 11 — Sincronización + Impresión + Pulido

### Prompt para Claude Code

```
Fase final de integración. Conecta sync, impresión y haz pulido general.

1. Integra core-sync en todas las apps:
   - En cada electron/main.ts, después de startServer, iniciar SyncEngine
   - Configurar tablas a sincronizar por app
   - Manejar eventos WebSocket del cloud

2. Integra core-printing en apps que lo necesiten (Caja, ERP, POS):
   - Configuración de impresoras en settings
   - Impresión de tickets de venta
   - Cola de impresión con reintentos

3. Implementa core-updater completo en todas las apps:
   - Configurar updateServer por app en electron-builder.yml
   - Verificar health check post-update

4. Testing end-to-end:
   - Crear script de setup: inicializa PostgreSQL, crea databases
   - Crear seeds de datos de prueba para cada app
   - Verificar que cada app arranca correctamente
   - Verificar que módulos se habilitan/deshabilitan según licencia
   - Verificar que UI responde a ModuleGate

5. Pulido:
   - Agregar loading states en todas las páginas
   - Error boundaries en React
   - Manejo de errores de red (offline graceful)
   - Logs estructurados con winston o similar
   - README.md con instrucciones de desarrollo, build y deploy

6. Build scripts:
   - turbo run build → compila todo
   - turbo run package --filter=caja → genera .exe de Caja
   - turbo run package → genera .exe de TODAS las apps
   - Verificar que los .exe funcionan standalone
```

---

## Resumen de Fases

| Fase | Nombre | Packages/Apps | Estimación |
|------|--------|---------------|------------|
| 0 | Scaffolding | Monorepo completo | 1 sesión |
| 1 | Core DB | core-db | 1 sesión |
| 2 | Core License | core-license | 1 sesión |
| 3 | Core Server + Electron | core-server, core-electron | 1-2 sesiones |
| 4 | Core Updater + Sync | core-updater, core-sync | 1 sesión |
| 5 | Módulos Base | mod-config, mod-catalogs | 2 sesiones |
| 6 | Módulos Facturación + POS | mod-invoicing, mod-pos | 2 sesiones |
| 7 | Módulos Restantes | mod-payroll, mod-inventory, mod-appointments, mod-reports | 2 sesiones |
| 8 | React Compartido | react-hooks, react-components | 1 sesión |
| 9 | App Caja (primera completa) | apps/caja | 2-3 sesiones |
| 10 | Apps Restantes | apps/facturacion, nominas, erp, servicios | 3-4 sesiones |
| 11 | Integración + Pulido | Todo | 2 sesiones |

**Total estimado: ~18-22 sesiones de Claude Code**

---

## Notas Importantes para Claude Code

1. **Siempre ejecutar las fases en orden** — cada fase depende de la anterior
2. **No sobrecargar contexto** — cada prompt es independiente, solo necesita el resultado de fases anteriores
3. **Testear cada fase** antes de avanzar: `turbo run build && turbo run test`
4. **PostgreSQL debe estar corriendo** localmente para fases 1 en adelante
5. **El archivo ARQUITECTURA-MASTER.md** debe estar en la raíz del proyecto como referencia permanente
