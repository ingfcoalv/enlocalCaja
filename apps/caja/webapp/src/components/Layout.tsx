import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Receipt,
  Tag,
  FolderTree,
  Landmark,
  FileText,
  Truck,
  RotateCcw,
  DollarSign,
  Warehouse,
  ClipboardList,
  Calendar,
  FileWarning,
  Layers,
  ChevronDown,
  Clock,
  Boxes,
  ArrowLeftRight,
  ClipboardCheck,
  History,
  FileBarChart,
  SendHorizonal,
  LayoutDashboard,
  Bell,
  Copy,
  ShoppingBag,
  CreditCard,
  Building2,
  Mail,
  Printer,
  Store,
  Globe,
  FileX,
  Weight,
  AlertTriangle,
  HardDrive,
  Monitor,
  Shield,
} from 'lucide-react'
import { useAuth, useModuleAccess, useLicenseStore } from '@enlocal/react-hooks'
import { LicenseAlert, UpdatePrompt, StampsIndicator, SyncStatusIndicator, OfflineIndicator } from '@enlocal/react-components'
import { useSocketListeners } from '../hooks/useSocketListeners'
import { useWarehouseBadge } from '../hooks/useWarehouseBadge'
import { useOnlineOrderStore } from '../stores/useOnlineOrderStore'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  to: string
  label: string
  icon: React.FC<{ className?: string }>
  badge?: boolean
  module?: string
}

interface NavGroup {
  label: string
  icon: React.FC<{ className?: string }>
  module?: string
  items: NavItem[]
}

// Top-level items (always visible, no module gating)
const topNavItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
  { to: '/online-orders', label: 'Pedidos Online', icon: Globe, badge: true },
]

// Collapsible groups
const navGroups: NavGroup[] = [
  {
    label: 'Catalogos',
    icon: Package,
    items: [
      { to: '/products', label: 'Productos', icon: Package },
      { to: '/categories', label: 'Categorias', icon: FolderTree },
      { to: '/customers', label: 'Clientes', icon: Users },
      { to: '/suppliers', label: 'Proveedores', icon: Building2 },
      { to: '/price-lists', label: 'Listas de Precios', icon: Tag },
    ],
  },
  {
    label: 'Ventas',
    icon: Receipt,
    items: [
      { to: '/sales', label: 'Historial', icon: Receipt },
      { to: '/credit', label: 'Creditos', icon: Landmark },
    ],
  },
  {
    label: 'Multi-Caja',
    icon: Monitor,
    module: 'multicaja',
    items: [
      { to: '/registers/status', label: 'Estado de Cajas', icon: Monitor },
      { to: '/registers/movements', label: 'Movimientos', icon: ArrowLeftRight },
      { to: '/registers/reports', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    label: 'Remisiones',
    icon: Truck,
    module: 'remissions',
    items: [
      { to: '/remissions', label: 'Notas', icon: Truck },
      { to: '/remissions/warehouse', label: 'Almacen', icon: Warehouse, badge: true },
      { to: '/returns', label: 'Devoluciones', icon: RotateCcw },
    ],
  },
  {
    label: 'Cotizaciones',
    icon: SendHorizonal,
    module: 'quotes',
    items: [
      { to: '/quotes', label: 'Cotizaciones', icon: SendHorizonal },
      { to: '/quotes?needs_followup=true', label: 'Seguimiento', icon: Bell },
      { to: '/quotes/templates', label: 'Plantillas', icon: Copy },
    ],
  },
  {
    label: 'Inventario',
    icon: Boxes,
    module: 'inventory',
    items: [
      { to: '/inventory', label: 'Dashboard', icon: BarChart3 },
      { to: '/inventory/movements', label: 'Movimientos', icon: ArrowLeftRight },
      { to: '/inventory/count', label: 'Conteo', icon: ClipboardCheck },
      { to: '/inventory/count-history', label: 'Historial', icon: History },
      { to: '/inventory/reports', label: 'Reportes', icon: FileBarChart },
    ],
  },
  {
    label: 'Cuentas por Cobrar',
    icon: DollarSign,
    module: 'remissions',
    items: [
      { to: '/receivables/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/receivables', label: 'CxC', icon: DollarSign },
      { to: '/receivables/aging', label: 'Antiguedad', icon: ClipboardList },
      { to: '/receivables/collections', label: 'Cobranza', icon: Calendar },
      { to: '/receivables/pending-complements', label: 'Complementos', icon: FileWarning },
      { to: '/invoices/consolidate', label: 'Consolidar', icon: Layers },
    ],
  },
  {
    label: 'Compras',
    icon: ShoppingBag,
    module: 'payables',
    items: [
      { to: '/purchase-orders', label: 'Ordenes', icon: ShoppingBag },
      { to: '/purchase-orders/warehouse', label: 'Recepcion', icon: Warehouse },
      { to: '/supplier-invoices', label: 'Facturas Prov.', icon: FileText },
      { to: '/purchase-returns', label: 'Devoluciones', icon: RotateCcw },
    ],
  },
  {
    label: 'Cuentas por Pagar',
    icon: CreditCard,
    module: 'payables',
    items: [
      { to: '/payables', label: 'CxP', icon: CreditCard },
      { to: '/payables/aging', label: 'Antiguedad', icon: ClipboardList },
      { to: '/payables/schedule', label: 'Calendario', icon: Calendar },
      { to: '/payables/cash-flow', label: 'Flujo de Caja', icon: BarChart3 },
    ],
  },
]

// Facturacion group (module-gated)
const invoicingGroup: NavGroup = {
  label: 'Facturacion',
  icon: Receipt,
  module: 'invoicing',
  items: [
    { to: '/invoicing', label: 'Facturas', icon: FileText },
    { to: '/invoicing/from-ticket', label: 'De Tickets', icon: Receipt },
    { to: '/invoicing/global', label: 'Fac. Global', icon: Globe },
    { to: '/invoicing/payment-complement', label: 'Comp. Pago', icon: CreditCard },
    { to: '/invoicing/credit-note', label: 'Nota Credito', icon: FileX },
    { to: '/invoicing/carta-porte', label: 'Carta Porte', icon: Truck },
    { to: '/invoicing/reports', label: 'Reportes', icon: BarChart3 },
  ],
}

// Reportes group
const reportsGroup: NavGroup = {
  label: 'Reportes',
  icon: BarChart3,
  items: [
    { to: '/reports', label: 'General', icon: BarChart3 },
    { to: '/reports/shift-history', label: 'Historial de Cortes', icon: History },
    { to: '/reports/cashier-performance', label: 'Por Cajero', icon: Users },
    { to: '/reports/register-comparison', label: 'Comparativo Cajas', icon: Monitor, module: 'multicaja' },
    { to: '/reports/cash-movements', label: 'Mov. Efectivo', icon: ArrowLeftRight },
    { to: '/reports/hourly-sales', label: 'Ventas por Hora', icon: Clock },
    { to: '/reports/product-performance', label: 'Por Producto', icon: Package },
    { to: '/reports/customer-sales', label: 'Por Cliente', icon: Users },
    { to: '/reports/shift-differences', label: 'Diferencias', icon: AlertTriangle },
    { to: '/reports/low-stock', label: 'Existencias Bajas', icon: AlertTriangle },
  ],
}

// Configuracion group (separate so it renders after bottom items)
const settingsGroup: NavGroup = {
  label: 'Configuracion',
  icon: Settings,
  items: [
    { to: '/settings/license', label: 'Licencia', icon: Shield },
    { to: '/settings', label: 'General', icon: Store },
    { to: '/settings/users', label: 'Usuarios', icon: Users },
    { to: '/settings/registers', label: 'Cajas', icon: Monitor },
    { to: '/settings/remissions', label: 'Remisiones', icon: Truck, module: 'remissions' },
    { to: '/settings/quotes', label: 'Cotizaciones', icon: SendHorizonal, module: 'quotes' },
    { to: '/settings/email', label: 'Email SMTP', icon: Mail, module: 'quotes' },
    { to: '/settings/purchases', label: 'Compras', icon: ShoppingBag, module: 'payables' },
    { to: '/settings/invoicing', label: 'Facturacion', icon: FileText, module: 'invoicing' },
    { to: '/settings/printers', label: 'Impresoras', icon: Printer },
    { to: '/settings/scale', label: 'Bascula', icon: Weight },
    { to: '/settings/ticket', label: 'Ticket', icon: Receipt },
    { to: '/settings/backup', label: 'Respaldos', icon: HardDrive },
  ],
}

function NavItemLink({
  item,
  onClick,
  badgeCount,
}: {
  item: NavItem
  onClick: () => void
  badgeCount?: number
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.to === '/settings' || item.to === '/remissions' || item.to === '/receivables' || item.to === '/inventory' || item.to === '/quotes' || item.to === '/purchase-orders' || item.to === '/payables' || item.to === '/suppliers'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-900/50 text-white'
            : 'text-primary-100 hover:bg-primary-700 hover:text-white'
        }`
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {item.label}
      {item.badge && badgeCount !== undefined && badgeCount > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
          {badgeCount}
        </span>
      )}
    </NavLink>
  )
}

function CollapsibleGroup({
  group,
  isOpen,
  onToggle,
  onNavClick,
  warehouseBadgeCount,
  pathname,
  moduleGate,
}: {
  group: NavGroup
  isOpen: boolean
  onToggle: () => void
  onNavClick: () => void
  warehouseBadgeCount: number
  pathname: string
  moduleGate: Record<string, boolean>
}) {
  // Filter items by module access (items without module are always visible)
  const visibleItems = group.items.filter((item) => {
    if (!item.module) return true
    return moduleGate[item.module] ?? true
  })

  if (visibleItems.length === 0) return null

  const hasActiveChild = visibleItems.some((item) => pathname === item.to || pathname.startsWith(item.to + '/'))
  const groupBadge = group.label === 'Remisiones' && warehouseBadgeCount > 0

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          hasActiveChild
            ? 'bg-primary-900/50 text-white'
            : 'text-primary-100 hover:bg-primary-700 hover:text-white'
        }`}
      >
        <group.icon className="h-5 w-5 flex-shrink-0" />
        {group.label}
        {groupBadge && (
          <span className="ml-auto mr-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
            {warehouseBadgeCount}
          </span>
        )}
        <ChevronDown
          className={`${groupBadge ? '' : 'ml-auto'} h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-primary-700 pl-3">
          {visibleItems.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              onClick={onNavClick}
              badgeCount={item.badge ? warehouseBadgeCount : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const { hasAccess: hasRemissions } = useModuleAccess('remissions')
  const { hasAccess: hasInvoicing } = useModuleAccess('invoicing')
  const { hasAccess: hasInventory } = useModuleAccess('inventory')
  const { hasAccess: hasQuotes } = useModuleAccess('quotes')
  const { hasAccess: hasPayables } = useModuleAccess('payables')
  const { hasAccess: hasMulticaja } = useModuleAccess('multicaja')
  const warehouseBadgeCount = useWarehouseBadge()
  const onlinePendingCount = useOnlineOrderStore(s => s.pendingCount)
  const newModulesAvailable = useLicenseStore(s => s.newModulesAvailable)
  const isTrial = useLicenseStore(s => s.isTrial)
  const trial = useLicenseStore(s => s.trial)

  // Central socket listeners
  useSocketListeners()

  // Fetch online orders on mount so badge count is populated
  useEffect(() => { useOnlineOrderStore.getState().fetchOrders() }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const isGroupOpen = (group: NavGroup) => {
    // Explicitly toggled
    if (openGroups[group.label] !== undefined) return openGroups[group.label]
    // Auto-open if current route is inside the group
    return group.items.some((item) => pathname === item.to || pathname.startsWith(item.to + '/'))
  }

  // Module gating map
  const moduleGate: Record<string, boolean> = {
    remissions: hasRemissions,
    invoicing: hasInvoicing,
    inventory: hasInventory,
    quotes: hasQuotes,
    payables: hasPayables,
    multicaja: hasMulticaja,
  }

  // Filter groups by module access
  const visibleGroups = navGroups.filter((g) => {
    if (!g.module) return true
    return moduleGate[g.module] ?? true
  })

  // (bottomNavItems replaced by reportsGroup)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">enLocal</h1>
              <p className="text-xs text-primary-200">Caja</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="rounded p-1 text-primary-200 hover:bg-primary-700 hover:text-white lg:hidden"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {/* Top standalone items */}
          {topNavItems.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              onClick={closeSidebar}
              badgeCount={item.to === '/online-orders' ? onlinePendingCount : undefined}
            />
          ))}

          {/* Separator */}
          <div className="my-2 border-t border-primary-700" />

          {/* Collapsible groups */}
          {visibleGroups.map((group) => (
            <CollapsibleGroup
              key={group.label}
              group={group}
              isOpen={isGroupOpen(group)}
              onToggle={() => toggleGroup(group.label)}
              onNavClick={closeSidebar}
              warehouseBadgeCount={warehouseBadgeCount}
              pathname={pathname}
              moduleGate={moduleGate}
            />
          ))}

          {/* Facturacion group */}
          {hasInvoicing && (
            <CollapsibleGroup
              group={invoicingGroup}
              isOpen={isGroupOpen(invoicingGroup)}
              onToggle={() => toggleGroup(invoicingGroup.label)}
              onNavClick={closeSidebar}
              warehouseBadgeCount={0}
              pathname={pathname}
              moduleGate={moduleGate}
            />
          )}

          {/* Separator */}
          <div className="my-2 border-t border-primary-700" />

          {/* Reportes group */}
          <CollapsibleGroup
            group={reportsGroup}
            isOpen={isGroupOpen(reportsGroup)}
            onToggle={() => toggleGroup(reportsGroup.label)}
            onNavClick={closeSidebar}
            warehouseBadgeCount={0}
            pathname={pathname}
            moduleGate={moduleGate}
          />

          {/* Configuracion group */}
          <CollapsibleGroup
            group={settingsGroup}
            isOpen={isGroupOpen(settingsGroup)}
            onToggle={() => toggleGroup(settingsGroup.label)}
            onNavClick={closeSidebar}
            warehouseBadgeCount={0}
            pathname={pathname}
            moduleGate={moduleGate}
          />
        </nav>

        {/* Stamps indicator */}
        <div className="border-t border-primary-700 px-3 py-2">
          <StampsIndicator />
        </div>

        {/* User info at bottom */}
        <div className="border-t border-primary-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || 'Usuario'}
              </p>
              <p className="text-xs text-primary-300 truncate">
                {user?.role || 'Sin rol'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-primary-300 transition-colors hover:bg-primary-700 hover:text-white"
              title="Cerrar sesion"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-4">
            <SyncStatusIndicator />
            <span className="text-sm text-gray-600">
              {user?.name || 'Usuario'}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </header>

        {/* Offline indicator */}
        <OfflineIndicator />

        {/* Trial banner */}
        {isTrial && trial && (
          <div
            className={`border-b px-4 py-2 text-sm flex items-center justify-between ${
              trial.daysRemaining <= 3
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <span>
              Periodo de prueba: <strong>{trial.daysRemaining} dia{trial.daysRemaining !== 1 ? 's' : ''}</strong> restante{trial.daysRemaining !== 1 ? 's' : ''}
            </span>
            <a
              href="https://todoenlocal.com"
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-4 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                trial.daysRemaining <= 3
                  ? 'bg-red-100 text-red-900 hover:bg-red-200'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              Comprar licencia
            </a>
          </div>
        )}

        {/* New modules available banner */}
        {newModulesAvailable.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
            <span>
              Nuevos modulos disponibles: {newModulesAvailable.join(', ')}.
              Reinicia la aplicacion para activarlos.
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-4 rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 transition-colors"
            >
              Reiniciar
            </button>
          </div>
        )}

        {/* License alert */}
        <div className="px-4 pt-2 lg:px-6">
          <LicenseAlert />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Update prompt (floating modal) */}
      <UpdatePrompt />
    </div>
  )
}
