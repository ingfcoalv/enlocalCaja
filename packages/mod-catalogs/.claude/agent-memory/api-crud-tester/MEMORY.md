# API CRUD Tester Memory - enlocal-suite

## Server Info
- App: caja at http://127.0.0.1:9005
- Auth: POST /api/auth/login with {"pin":"1234"} to get fresh JWT token
- Health check: GET /api/health

## Critical: Server Runs TSX (Source), NOT dist
- The server process is `npx tsx apps/caja/dev-server.ts` — it executes TypeScript source directly
- TSX reads from `packages/mod-*/src/` — compiled dist is NOT used at runtime
- Log file: /tmp/caja-server.log

## Known Issues (Unfixed as of 2026-02-16)
- BUG 3 (Invoice PDF crash): `customers.codigoPostal` referenced in cfdi.routes.ts line 265 but
  the field is actually `codigoPostalFiscal` in customers schema. Fix: change
  `customerCodigoPostal: customers.codigoPostal` → `customerCodigoPostal: customers.codigoPostalFiscal`
  in `/packages/mod-invoicing/src/routes/cfdi.routes.ts`

## Verified Fixed (2026-02-16)
- BUG 1: Kardex without date params returns 200 (was 500)
- BUG 2: Invalid numeric string "invalid_string" for cost returns 400 with validation error
- BUG 4: from-sales accepts both "salesIds" and "saleIds" field names
- BUG 5: Non-existent category/product returns JSON 404, NOT HTML
- BUG 6: Dashboard/summary shows correct totals for today's date (timezone fixed)
- BUG 7: creditLimit accepts both number and string types
- BUG 8: Negative/zero quantity returns 400; empty payments array returns 400

## Schema Notes
- `customers.codigoPostalFiscal` (NOT `codigoPostal`) for fiscal postal code
- Invoice items: `invoiceItems` table with nullable `satCode`, `satUnit`
- Drizzle leftJoin returns null for all customer fields when customerId is null (safe with || fallbacks)

## Route Structure (mod-invoicing)
- Mounted at /api/invoices via authMiddleware
- invoices.routes.ts has GET /:id (can conflict with cfdi.routes.ts /:id/pdf)
- cfdi.routes.ts has /:id/stamp, /:id/cancel, /:id/xml, /:id/pdf
- mount.ts mounts invoicesRoutes FIRST, then cfdiRoutes — both at /api/invoices
