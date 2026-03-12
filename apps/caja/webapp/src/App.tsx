import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth, connectSocket, disconnectSocket, useLicenseStore } from '@enlocal/react-hooks'
import { ProtectedRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
// Activation is now handled by the Electron launcher window
import DashboardPage from './pages/DashboardPage'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import SalesPage from './pages/SalesPage'
import CreditPage from './pages/CreditPage'
import InvoicingPage from './pages/InvoicingPage'
import InvoiceFromTicketPage from './pages/InvoiceFromTicketPage'
import GlobalInvoicePage from './pages/GlobalInvoicePage'
import PaymentComplementPage from './pages/PaymentComplementPage'
import CreditNotePage from './pages/CreditNotePage'
import CartaPortePage from './pages/CartaPortePage'
import InvoicingSettingsPage from './pages/InvoicingSettingsPage'
import InvoiceReportsPage from './pages/InvoiceReportsPage'
import ReportsPage from './pages/ReportsPage'
import LowStockReportPage from './pages/LowStockReportPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import PriceListsPage from './pages/PriceListsPage'
import CategoriesPage from './pages/CategoriesPage'
import RemissionsPage from './pages/RemissionsPage'
import WarehousePage from './pages/WarehousePage'
import ReturnsPage from './pages/ReturnsPage'
import ProcessReturnPage from './pages/ProcessReturnPage'
import ReceivablesPage from './pages/ReceivablesPage'
import AgingReportPage from './pages/AgingReportPage'
import CustomerStatementPage from './pages/CustomerStatementPage'
import CollectionSchedulePage from './pages/CollectionSchedulePage'
import PendingComplementsPage from './pages/PendingComplementsPage'
import ConsolidateInvoicePage from './pages/ConsolidateInvoicePage'
import InventoryDashboardPage from './pages/InventoryDashboardPage'
import InventoryMovementsPage from './pages/InventoryMovementsPage'
import InventoryCountPage from './pages/InventoryCountPage'
import CountHistoryPage from './pages/CountHistoryPage'
import InventoryReportsPage from './pages/InventoryReportsPage'
import QuotesPage from './pages/QuotesPage'
import QuoteTemplatesPage from './pages/QuoteTemplatesPage'
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'
import PurchaseOrderWarehousePage from './pages/PurchaseOrderWarehousePage'
import SupplierInvoicesPage from './pages/SupplierInvoicesPage'
import PayablesPage from './pages/PayablesPage'
import PayablesAgingPage from './pages/PayablesAgingPage'
import PayablesStatementPage from './pages/PayablesStatementPage'
import PayablesSchedulePage from './pages/PayablesSchedulePage'
import PayablesCashFlowPage from './pages/PayablesCashFlowPage'
import PurchaseReturnsPage from './pages/PurchaseReturnsPage'
import SuppliersPage from './pages/SuppliersPage'
import RemissionSettingsPage from './pages/RemissionSettingsPage'
import QuoteSettingsPage from './pages/QuoteSettingsPage'
import EmailSettingsPage from './pages/EmailSettingsPage'
import BatchPayPage from './pages/BatchPayPage'
import PayablesSettingsPage from './pages/PayablesSettingsPage'
import PrinterSettingsPage from './pages/PrinterSettingsPage'
import ScaleSettingsPage from './pages/ScaleSettingsPage'
import TicketSettingsPage from './pages/TicketSettingsPage'
import BackupPage from './pages/BackupPage'
import CxCDashboardPage from './pages/CxCDashboardPage'
import RegistersPage from './pages/RegistersPage'
import LicenseSettingsPage from './pages/LicenseSettingsPage'
import OnlineOrdersPage from './pages/OnlineOrdersPage'
import RegisterStatusPage from './pages/RegisterStatusPage'
import CashMovementsPage from './pages/CashMovementsPage'
import RegisterReportsPage from './pages/RegisterReportsPage'
import ShiftHistoryReportPage from './pages/ShiftHistoryReportPage'
import CashierPerformancePage from './pages/CashierPerformancePage'
import RegisterComparisonPage from './pages/RegisterComparisonPage'
import CashMovementsReportPage from './pages/CashMovementsReportPage'
import HourlySalesPage from './pages/HourlySalesPage'
import ProductPerformancePage from './pages/ProductPerformancePage'
import CustomerSalesPage from './pages/CustomerSalesPage'
import ShiftDifferencesPage from './pages/ShiftDifferencesPage'

function AppInit() {
  const { setBaseUrl, isAuthenticated, token } = useAuth()
  const fetchFullInfo = useLicenseStore((s) => s.fetchFullInfo)

  useEffect(() => {
    // Set the API base URL to the current origin (proxied by Vite in dev)
    const baseUrl = window.location.origin
    setBaseUrl(baseUrl)

    // Initialize license store on app start
    fetchFullInfo()
  }, [setBaseUrl, fetchFullInfo])

  // Connect/disconnect socket based on auth state
  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket(token, window.location.origin)
    } else {
      disconnectSocket()
    }
    return () => { disconnectSocket() }
  }, [isAuthenticated, token])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInit />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activation" element={<Navigate to="/login" replace />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/online-orders" element={<OnlineOrdersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/credit" element={<CreditPage />} />
          <Route path="/invoicing" element={<InvoicingPage />} />
          <Route path="/invoicing/new" element={<InvoicingPage />} />
          <Route path="/invoicing/:id" element={<InvoicingPage />} />
          <Route path="/invoicing/from-ticket" element={<InvoiceFromTicketPage />} />
          <Route path="/invoicing/global" element={<GlobalInvoicePage />} />
          <Route path="/invoicing/payment-complement" element={<PaymentComplementPage />} />
          <Route path="/invoicing/credit-note" element={<CreditNotePage />} />
          <Route path="/invoicing/carta-porte" element={<CartaPortePage />} />
          <Route path="/invoicing/reports" element={<InvoiceReportsPage />} />
          <Route path="/settings/invoicing" element={<InvoicingSettingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/low-stock" element={<LowStockReportPage />} />
          <Route path="/reports/shift-history" element={<ShiftHistoryReportPage />} />
          <Route path="/reports/cashier-performance" element={<CashierPerformancePage />} />
          <Route path="/reports/register-comparison" element={<RegisterComparisonPage />} />
          <Route path="/reports/cash-movements" element={<CashMovementsReportPage />} />
          <Route path="/reports/hourly-sales" element={<HourlySalesPage />} />
          <Route path="/reports/product-performance" element={<ProductPerformancePage />} />
          <Route path="/reports/customer-sales" element={<CustomerSalesPage />} />
          <Route path="/reports/shift-differences" element={<ShiftDifferencesPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/price-lists" element={<PriceListsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/users" element={<UsersPage />} />
          <Route path="/settings/remissions" element={<RemissionSettingsPage />} />
          <Route path="/settings/quotes" element={<QuoteSettingsPage />} />
          <Route path="/settings/email" element={<EmailSettingsPage />} />
          <Route path="/settings/purchases" element={<PayablesSettingsPage />} />
          <Route path="/settings/printers" element={<PrinterSettingsPage />} />
          <Route path="/settings/scale" element={<ScaleSettingsPage />} />
          <Route path="/settings/ticket" element={<TicketSettingsPage />} />
          <Route path="/settings/backup" element={<BackupPage />} />
          <Route path="/settings/registers" element={<RegistersPage />} />
          <Route path="/settings/license" element={<LicenseSettingsPage />} />

          {/* Remissions */}
          <Route path="/remissions" element={<RemissionsPage />} />
          <Route path="/remissions/new" element={<RemissionsPage />} />
          <Route path="/remissions/:id" element={<RemissionsPage />} />
          <Route path="/remissions/warehouse" element={<WarehousePage />} />

          {/* Returns */}
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/returns/:id/process" element={<ProcessReturnPage />} />

          {/* Receivables (CxC) */}
          <Route path="/receivables/dashboard" element={<CxCDashboardPage />} />
          <Route path="/receivables" element={<ReceivablesPage />} />
          <Route path="/receivables/aging" element={<AgingReportPage />} />
          <Route path="/receivables/statement/:customerId" element={<CustomerStatementPage />} />
          <Route path="/receivables/collections" element={<CollectionSchedulePage />} />
          <Route path="/receivables/pending-complements" element={<PendingComplementsPage />} />
          <Route path="/invoices/consolidate" element={<ConsolidateInvoicePage />} />

          {/* Quotes */}
          <Route path="/quotes" element={<QuotesPage />} />
          <Route path="/quotes/new" element={<QuotesPage />} />
          <Route path="/quotes/templates" element={<QuoteTemplatesPage />} />
          <Route path="/quotes/:id" element={<QuotesPage />} />

          {/* Suppliers */}
          <Route path="/suppliers" element={<SuppliersPage />} />

          {/* Purchase Orders (Compras) */}
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/new" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/warehouse" element={<PurchaseOrderWarehousePage />} />

          {/* Supplier Invoices */}
          <Route path="/supplier-invoices" element={<SupplierInvoicesPage />} />

          {/* Payables (CxP) */}
          <Route path="/payables" element={<PayablesPage />} />
          <Route path="/payables/batch-pay" element={<BatchPayPage />} />
          <Route path="/payables/aging" element={<PayablesAgingPage />} />
          <Route path="/payables/statement/:supplierId" element={<PayablesStatementPage />} />
          <Route path="/payables/schedule" element={<PayablesSchedulePage />} />
          <Route path="/payables/cash-flow" element={<PayablesCashFlowPage />} />

          {/* Purchase Returns */}
          <Route path="/purchase-returns" element={<PurchaseReturnsPage />} />

          {/* Multi-Caja */}
          <Route path="/registers/status" element={<RegisterStatusPage />} />
          <Route path="/registers/movements" element={<CashMovementsPage />} />
          <Route path="/registers/reports" element={<RegisterReportsPage />} />

          {/* Inventory */}
          <Route path="/inventory" element={<InventoryDashboardPage />} />
          <Route path="/inventory/movements" element={<InventoryMovementsPage />} />
          <Route path="/inventory/count" element={<InventoryCountPage />} />
          <Route path="/inventory/count-history" element={<CountHistoryPage />} />
          <Route path="/inventory/reports" element={<InventoryReportsPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
