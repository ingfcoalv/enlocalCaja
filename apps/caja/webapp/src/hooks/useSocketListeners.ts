import { useEffect } from 'react'
import { getSocket, useAuth, useToast, useLicenseStore } from '@enlocal/react-hooks'
import { useRemissionStore } from '../stores/useRemissionStore'
import { useOnlineOrderStore } from '../stores/useOnlineOrderStore'
import { playNewOrderAlert } from '../lib/sounds'
import { useReturnStore } from '../stores/useReturnStore'
import { useReceivableStore } from '../stores/useReceivableStore'
import { useQuoteStore } from '../stores/useQuoteStore'
import { useInvoiceStore } from '../stores/useInvoiceStore'
import { useScaleStore } from '../stores/useScaleStore'

/**
 * Central socket listener hook. Call once from Layout.
 * Listens to all remission/return/receivable events and updates stores.
 */
export function useSocketListeners() {
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // ─── Remission events ───────────────────────────────
    const onRemissionCreated = (data: any) => {
      const store = useRemissionStore.getState()
      addOrUpdate(store, data)
      if (user?.role === 'warehouse' || user?.role === 'admin') {
        toast.info(`Nueva nota de remision ${data.series || ''}-${String(data.folio || '').padStart(4, '0')}`)
      }
    }

    const onRemissionConfirmed = (data: any) => {
      const store = useRemissionStore.getState()
      addOrUpdate(store, data)
      if (user?.role === 'warehouse' || user?.role === 'admin') {
        toast.info(`Nota confirmada — lista para surtir`)
      }
    }

    const onRemissionCancelled = (data: any) => {
      const store = useRemissionStore.getState()
      addOrUpdate(store, data)
    }

    const onRemissionPrepared = (data: any) => {
      const store = useRemissionStore.getState()
      addOrUpdate(store, data)
      if (user?.role !== 'warehouse') {
        toast.info(`Nota surtida y lista para entregar`)
      }
    }

    const onRemissionDelivered = (data: any) => {
      const store = useRemissionStore.getState()
      addOrUpdate(store, data)
      toast.success(`Nota entregada exitosamente`)
    }

    // ─── Return events ──────────────────────────────────
    const onReturnRequested = (data: any) => {
      const store = useReturnStore.getState()
      addOrUpdateReturn(store, data)
      if (user?.role === 'warehouse' || user?.role === 'admin') {
        toast.warning(`Nueva solicitud de devolucion`)
      }
    }

    const onReturnInReview = (data: any) => {
      const store = useReturnStore.getState()
      addOrUpdateReturn(store, data)
    }

    const onReturnProcessed = (data: any) => {
      const returnData = data.return_ || data
      const store = useReturnStore.getState()
      addOrUpdateReturn(store, returnData)
      toast.info(`Devolucion procesada`)
    }

    const onReturnRejected = (data: any) => {
      const store = useReturnStore.getState()
      addOrUpdateReturn(store, data)
    }

    // ─── Receivable events ──────────────────────────────
    const onReceivablePayment = (data: any) => {
      const rec = data.receivable || data
      const store = useReceivableStore.getState()
      addOrUpdateReceivable(store, rec)
    }

    const onReceivablePaid = (_data: any) => {
      toast.success(`Cuenta por cobrar liquidada`)
    }

    // ─── Quote events ─────────────────────────────────────
    const onQuoteCreated = (data: any) => {
      addOrUpdateQuote(data)
      toast.info(`Nueva cotizacion creada`)
    }

    const onQuoteSent = (data: any) => {
      addOrUpdateQuote(data)
      toast.info(`Cotizacion enviada`)
    }

    const onQuoteAccepted = (data: any) => {
      addOrUpdateQuote(data)
      toast.success(`Cotizacion aceptada`)
    }

    const onQuoteRejected = (data: any) => {
      addOrUpdateQuote(data)
      toast.warning(`Cotizacion rechazada`)
    }

    const onQuoteExpired = (data: any) => {
      addOrUpdateQuote(data)
    }

    const onQuoteConverted = (data: any) => {
      addOrUpdateQuote(data?.quote || data)
      toast.success(`Cotizacion convertida`)
    }

    const onQuoteNewVersion = (data: any) => {
      addOrUpdateQuote(data)
      toast.info(`Nueva version de cotizacion`)
    }

    const onQuoteCancelled = (data: any) => {
      addOrUpdateQuote(data)
    }

    // ─── Invoice events ─────────────────────────────────
    const onInvoiceStamped = (data: any) => {
      addOrUpdateInvoice(data)
      toast.success(`Factura ${data.series || ''}${data.folio || ''} timbrada exitosamente`)
    }

    const onInvoiceStampError = (data: any) => {
      addOrUpdateInvoice(data)
      toast.error(`Error al timbrar factura: ${data.errorMessage || 'Error desconocido'}`)
    }

    const onInvoiceCancelled = (data: any) => {
      addOrUpdateInvoice(data)
      toast.info(`Factura ${data.series || ''}${data.folio || ''} cancelada`)
    }

    const onInvoiceCancelRejected = (data: any) => {
      addOrUpdateInvoice(data)
      toast.warning(`Cancelacion de factura rechazada`)
    }

    const onInvoiceCertExpiring = (data: any) => {
      toast.warning(`El certificado de sello digital expira pronto: ${data.validTo || ''}`)
    }

    // ─── Stamps events ────────────────────────────────
    const onStampsLow = (data: any) => {
      toast.warning(`Timbres bajos: ${data.available} disponibles`)
    }

    const onStampsDepleted = () => {
      toast.error('Sin timbres disponibles. Adquiere mas en todoenlocal.com')
    }

    // ─── Scale events ─────────────────────────────────
    const onScaleWeight = (data: any) => {
      useScaleStore.getState().setWeight(data.weight ?? 0, data.unit ?? 'kg', data.stable ?? false)
    }
    const onScaleConnected = () => {
      useScaleStore.getState().setConnected(true)
    }
    const onScaleDisconnected = () => {
      useScaleStore.getState().setConnected(false)
    }
    const onScaleError = (data: any) => {
      console.error('[scale]', data?.message)
    }

    // ─── Online Order events ─────────────────────────
    const onOnlineOrderNew = (data: any) => {
      useOnlineOrderStore.getState().updateFromSocket()
      playNewOrderAlert()
      toast.info(`Nuevo pedido online: ${data.customer_name || 'Cliente'}`)
    }

    const onOnlineOrderUpdated = () => {
      useOnlineOrderStore.getState().updateFromSocket()
    }

    // ─── Sync events ─────────────────────────────────
    const onSyncCompleted = () => {
      useLicenseStore.getState().fetchFullInfo()
    }

    // ─── License module changes ──────────────────────
    const onModulesChanged = (data: { newModules: string[]; requiresRestart: boolean }) => {
      if (data.requiresRestart && data.newModules.length > 0) {
        useLicenseStore.getState().setNewModulesAvailable(data.newModules)
      }
    }

    socket.on('online-order:new', onOnlineOrderNew)
    socket.on('online-order:updated', onOnlineOrderUpdated)

    socket.on('scale:weight', onScaleWeight)
    socket.on('scale:connected', onScaleConnected)
    socket.on('scale:disconnected', onScaleDisconnected)
    socket.on('scale:error', onScaleError)

    socket.on('stamps:low', onStampsLow)
    socket.on('stamps:depleted', onStampsDepleted)
    socket.on('sync:completed', onSyncCompleted)
    socket.on('license:modules-changed', onModulesChanged)

    socket.on('invoice:stamped', onInvoiceStamped)
    socket.on('invoice:stamp_error', onInvoiceStampError)
    socket.on('invoice:cancelled', onInvoiceCancelled)
    socket.on('invoice:cancel_rejected', onInvoiceCancelRejected)
    socket.on('invoice:cert_expiring', onInvoiceCertExpiring)

    socket.on('remission:created', onRemissionCreated)
    socket.on('remission:confirmed', onRemissionConfirmed)
    socket.on('remission:cancelled', onRemissionCancelled)
    socket.on('remission:prepared', onRemissionPrepared)
    socket.on('remission:delivered', onRemissionDelivered)
    socket.on('return:requested', onReturnRequested)
    socket.on('return:in_review', onReturnInReview)
    socket.on('return:processed', onReturnProcessed)
    socket.on('return:rejected', onReturnRejected)
    socket.on('receivable:payment', onReceivablePayment)
    socket.on('receivable:paid', onReceivablePaid)
    socket.on('quote:created', onQuoteCreated)
    socket.on('quote:sent', onQuoteSent)
    socket.on('quote:accepted', onQuoteAccepted)
    socket.on('quote:rejected', onQuoteRejected)
    socket.on('quote:expired', onQuoteExpired)
    socket.on('quote:converted', onQuoteConverted)
    socket.on('quote:new_version', onQuoteNewVersion)
    socket.on('quote:cancelled', onQuoteCancelled)

    return () => {
      socket.off('online-order:new', onOnlineOrderNew)
      socket.off('online-order:updated', onOnlineOrderUpdated)
      socket.off('scale:weight', onScaleWeight)
      socket.off('scale:connected', onScaleConnected)
      socket.off('scale:disconnected', onScaleDisconnected)
      socket.off('scale:error', onScaleError)
      socket.off('stamps:low', onStampsLow)
      socket.off('stamps:depleted', onStampsDepleted)
      socket.off('sync:completed', onSyncCompleted)
      socket.off('license:modules-changed', onModulesChanged)
      socket.off('invoice:stamped', onInvoiceStamped)
      socket.off('invoice:stamp_error', onInvoiceStampError)
      socket.off('invoice:cancelled', onInvoiceCancelled)
      socket.off('invoice:cancel_rejected', onInvoiceCancelRejected)
      socket.off('invoice:cert_expiring', onInvoiceCertExpiring)
      socket.off('remission:created', onRemissionCreated)
      socket.off('remission:confirmed', onRemissionConfirmed)
      socket.off('remission:cancelled', onRemissionCancelled)
      socket.off('remission:prepared', onRemissionPrepared)
      socket.off('remission:delivered', onRemissionDelivered)
      socket.off('return:requested', onReturnRequested)
      socket.off('return:in_review', onReturnInReview)
      socket.off('return:processed', onReturnProcessed)
      socket.off('return:rejected', onReturnRejected)
      socket.off('receivable:payment', onReceivablePayment)
      socket.off('receivable:paid', onReceivablePaid)
      socket.off('quote:created', onQuoteCreated)
      socket.off('quote:sent', onQuoteSent)
      socket.off('quote:accepted', onQuoteAccepted)
      socket.off('quote:rejected', onQuoteRejected)
      socket.off('quote:expired', onQuoteExpired)
      socket.off('quote:converted', onQuoteConverted)
      socket.off('quote:new_version', onQuoteNewVersion)
      socket.off('quote:cancelled', onQuoteCancelled)
    }
  }, [user?.role, toast])
}

// Helper: add or update a remission in the store array
function addOrUpdate(store: any, data: any) {
  const id = data?.id || data?.data?.id
  if (!id) return
  const item = data.data || data
  const exists = store.remissions.some((r: any) => r.id === id)
  if (exists) {
    useRemissionStore.setState({
      remissions: store.remissions.map((r: any) => r.id === id ? { ...r, ...item } : r),
      currentRemission: store.currentRemission?.id === id ? { ...store.currentRemission, ...item } : store.currentRemission,
    })
  } else {
    useRemissionStore.setState({ remissions: [item, ...store.remissions] })
  }
}

function addOrUpdateReturn(store: any, data: any) {
  const id = data?.id || data?.data?.id
  if (!id) return
  const item = data.data || data
  const exists = store.returns.some((r: any) => r.id === id)
  if (exists) {
    useReturnStore.setState({
      returns: store.returns.map((r: any) => r.id === id ? { ...r, ...item } : r),
      currentReturn: store.currentReturn?.id === id ? { ...store.currentReturn, ...item } : store.currentReturn,
    })
  } else {
    useReturnStore.setState({ returns: [item, ...store.returns] })
  }
}

function addOrUpdateQuote(data: any) {
  const id = data?.id || data?.data?.id
  if (!id) return
  const item = data.data || data
  const store = useQuoteStore.getState()
  const exists = store.quotes.some((q: any) => q.id === id)
  if (exists) {
    useQuoteStore.setState({
      quotes: store.quotes.map((q: any) => q.id === id ? { ...q, ...item } : q),
      currentQuote: store.currentQuote?.id === id ? { ...store.currentQuote, ...item } : store.currentQuote,
    })
  } else {
    useQuoteStore.setState({ quotes: [item, ...store.quotes] })
  }
}

function addOrUpdateReceivable(store: any, data: any) {
  const id = data?.id || data?.data?.id
  if (!id) return
  const item = data.data || data
  const exists = store.receivables.some((r: any) => r.id === id)
  if (exists) {
    useReceivableStore.setState({
      receivables: store.receivables.map((r: any) => r.id === id ? { ...r, ...item } : r),
    })
  } else {
    useReceivableStore.setState({ receivables: [item, ...store.receivables] })
  }
}

function addOrUpdateInvoice(data: any) {
  const id = data?.id || data?.data?.id
  if (!id) return
  const item = data.data || data
  const store = useInvoiceStore.getState()
  const exists = store.invoices.some((inv: any) => inv.id === id)
  if (exists) {
    useInvoiceStore.setState({
      invoices: store.invoices.map((inv: any) => inv.id === id ? { ...inv, ...item } : inv),
      currentInvoice: store.currentInvoice?.id === id ? { ...store.currentInvoice, ...item } : store.currentInvoice,
    })
  } else {
    useInvoiceStore.setState({ invoices: [item, ...store.invoices] })
  }
}
