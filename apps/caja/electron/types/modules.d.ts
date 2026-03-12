declare module '@enlocal/mod-config' {
  export function mountConfigRoutes(app: any, db: any): void
  export function mountGenericSettingsRoutes(app: any): void
  export class ScaleService {
    connect(scale: any, io: any): Promise<void>
    disconnect(): void
  }
  export function loadScales(db: any): Promise<any[]>
}
declare module '@enlocal/mod-catalogs' {
  export function mountCatalogRoutes(app: any, db: any): void
}
declare module '@enlocal/mod-pos' {
  export function mountPosRoutes(app: any, db: any): void
}
declare module '@enlocal/mod-reports' {
  export function mountReportRoutes(app: any, db: any): void
}
declare module '@enlocal/mod-invoicing' {
  export function mountInvoicingRoutes(app: any, db: any): void
  export function startInvoicingCronJobs(db: any): () => void
}
declare module '@enlocal/mod-inventory' {
  export function mountInventoryRoutes(app: any, db: any): void
}
declare module '@enlocal/mod-remissions' {
  export function mountRemissionRoutes(app: any, db: any): void
  export function startRemissionCronJobs(db: any): () => void
}
declare module '@enlocal/mod-quotes' {
  export function mountQuoteRoutes(app: any, db: any): void
  export function startQuoteCronJobs(db: any): () => void
}
declare module '@enlocal/mod-payables' {
  export function mountPayableRoutes(app: any, db: any): void
  export function startPayableCronJobs(db: any): () => void
}
