import { useState, useEffect, useCallback } from 'react'

const API = '/api/backups'

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (mins < 1) return 'Hace un momento'
  if (mins < 60) return `Hace ${mins} min`
  if (hrs < 24) return `Hace ${hrs}h`
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} dias`
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function fullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const TIPO_LABELS: Record<string, string> = {
  apertura: 'Apertura', mediodia: 'Automatico', cierre: 'Cierre',
  manual: 'Manual', 'pre-restauracion': 'Seguridad',
}

const TIPO_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  apertura: { bg: '#E8F5E9', fg: '#2E7D32', border: '#A5D6A7' },
  mediodia: { bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9' },
  cierre: { bg: '#FFF3E0', fg: '#E65100', border: '#FFCC80' },
  manual: { bg: '#F3E5F5', fg: '#6A1B9A', border: '#CE93D8' },
  'pre-restauracion': { bg: '#FCE4EC', fg: '#C62828', border: '#EF9A9A' },
}

// ─── Icon components ────────────────────────────────────────────

function Svg({ d, size = 16, stroke = 'currentColor', fill = 'none', sw = 2 }: {
  d: string; size?: number; stroke?: string; fill?: string; sw?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const I = {
  Shield: () => <Svg d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" size={20} />,
  Download: () => <Svg d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  Folder: () => <Svg d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />,
  Clock: () => <Svg d="M12 6v6l4 2M22 12A10 10 0 112 12a10 10 0 0120 0z" size={14} />,
  Trash: () => <Svg d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={14} />,
  Refresh: () => <Svg d="M23 4v6h-6M20.49 15a9 9 0 11-2.12-9.36L23 10" size={14} />,
  Check: () => <Svg d="M20 6L9 17l-5-5" sw={2.5} />,
  Alert: () => <Svg d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />,
  Database: () => <Svg d="M21 5c0 1.66-4 3-9 3S3 6.66 3 5s4-3 9-3 9 1.34 9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" size={18} />,
  Cloud: () => <Svg d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />,
  HardDrive: () => <Svg d="M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11zM6 16h.01M10 16h.01" />,
  Eye: () => <Svg d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 110 6 3 3 0 010-6z" />,
  Info: () => <Svg d="M12 16v-4M12 8h.01M22 12A10 10 0 112 12a10 10 0 0120 0z" />,
  ArrowLeft: () => <Svg d="M19 12H5M12 19l-7-7 7-7" />,
}

// ─── Main Component ─────────────────────────────────────────────

export default function BackupPage() {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<any>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [tab, setTab] = useState<'smart' | 'dumps'>('smart')

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch(API)
      setInfo(await res.json())
    } catch {
      showToast('Error cargando respaldos', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInfo()
    const iv = setInterval(fetchInfo, 30000)
    return () => clearInterval(iv)
  }, [fetchInfo])

  function showToast(message: string, type = 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  async function createSmartBackup() {
    setActionLoading('smart-create')
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'manual' }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Respaldo creado: ${data.sizeMB} MB - ${data.totalRows} registros`, 'success')
        fetchInfo()
      } else showToast(data.error, 'error')
    } catch {
      showToast('Error creando respaldo', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function previewRestore(backup: any) {
    try {
      const res = await fetch(`${API}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: backup.filepath }),
      })
      const data = await res.json()
      setPreviewData({ ...data, backup })
    } catch {
      showToast('Error previsualizando respaldo', 'error')
    }
  }

  async function executeRestore() {
    if (!confirmRestore) return
    setActionLoading('restore')
    setConfirmRestore(null)
    try {
      const res = await fetch(`${API}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: confirmRestore.filepath }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message, 'success')
        fetchInfo()
      } else showToast(data.error, 'error')
    } catch {
      showToast('Error restaurando', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteBackup(filename: string, mode = 'smart') {
    const endpoint = mode === 'smart' ? `${API}/${filename}` : `${API}/dumps/${filename}`
    try {
      await fetch(endpoint, { method: 'DELETE' })
      showToast('Eliminado', 'info')
      fetchInfo()
    } catch {
      showToast('Error eliminando', 'error')
    }
  }

  async function createFullDump() {
    setActionLoading('dump-create')
    try {
      const res = await fetch(`${API}/dumps`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(`Dump completo: ${data.sizeMB} MB`, 'success')
        fetchInfo()
      } else showToast(data.error, 'error')
    } catch {
      showToast('Error creando dump', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function restoreFullDump(dumpItem: any) {
    setActionLoading('dump-restore')
    try {
      const res = await fetch(`${API}/dumps/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: dumpItem.filepath }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message, 'success')
        fetchInfo()
      } else showToast(data.error, 'error')
    } catch {
      showToast('Error restaurando dump', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
        <p style={{ color: '#9e9e9e', marginTop: 12 }}>Cargando respaldos...</p>
      </div>
    )
  }

  const health = info?.healthStatus
  const healthColor = health?.status === 'healthy' ? '#2E7D32' : health?.status === 'warning' ? '#E65100' : '#C62828'

  return (
    <div style={s.root}>
      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === 'success' ? '#2E7D32' : toast.type === 'error' ? '#C62828' : '#1565C0',
        }}>
          {toast.type === 'success' ? <I.Check /> : toast.type === 'error' ? <I.Alert /> : <I.Info />}
          <span style={{ marginLeft: 8 }}>{toast.message}</span>
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div style={s.overlay} onClick={() => setPreviewData(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}><I.Eye /> Reporte de compatibilidad</h3>
            <div style={s.previewGrid}>
              <PreviewRow label="Version del respaldo" value={`v${previewData.compatibilityReport.backupVersion}`} />
              <PreviewRow label="Version actual" value={`v${previewData.compatibilityReport.currentVersion}`} />
              <PreviewRow label="Fecha del respaldo" value={fullDate(previewData.manifest.createdAt)} />
              <PreviewRow label="Registros totales" value={previewData.manifest.totalRows.toLocaleString()} />
              <PreviewRow label="Tablas compatibles" value={`${previewData.compatibilityReport.commonTables.length} tablas`} ok />
            </div>
            {previewData.compatibilityReport.removedTables.length > 0 && (
              <div style={s.previewWarning}>
                <strong>Tablas ignoradas</strong> (no existen en la version actual):
                <div style={s.tagList}>
                  {previewData.compatibilityReport.removedTables.map((t: string) => (
                    <span key={t} style={{ ...s.tag, ...s.tagRed }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {previewData.compatibilityReport.newTables.length > 0 && (
              <div style={s.previewInfo}>
                <strong>Tablas nuevas</strong> (quedaran vacias):
                <div style={s.tagList}>
                  {previewData.compatibilityReport.newTables.map((t: string) => (
                    <span key={t} style={{ ...s.tag, ...s.tagBlue }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {previewData.compatibilityReport.versionMatch && (
              <div style={s.previewOk}><I.Check /> Las versiones coinciden. Restauracion completa sin perdida de datos.</div>
            )}
            <div style={s.modalActions}>
              <button style={s.btnOutline} onClick={() => setPreviewData(null)}>Cerrar</button>
              <button style={s.btnPrimary} onClick={() => { setConfirmRestore(previewData.backup); setPreviewData(null) }}>
                Restaurar este respaldo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      {confirmRestore && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ ...s.modalIconBox, background: '#FFF3E0', color: '#E65100' }}><I.Alert /></div>
            <h3 style={s.modalTitle}>Restaurar este respaldo?</h3>
            <p style={s.modalText}>
              Se creara un <strong>respaldo de seguridad automatico</strong> de tu base de datos actual antes de restaurar.
            </p>
            <div style={s.previewGrid}>
              <PreviewRow label="Archivo" value={confirmRestore.filename} />
              <PreviewRow label="Fecha" value={fullDate(confirmRestore.date)} />
              <PreviewRow label="Tamano" value={`${confirmRestore.sizeMB} MB`} />
              {confirmRestore.appVersion && <PreviewRow label="Version" value={`v${confirmRestore.appVersion}`} />}
            </div>
            <div style={s.modalActions}>
              <button style={s.btnOutline} onClick={() => setConfirmRestore(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={executeRestore}>Restaurar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/settings" style={{ color: '#9e9e9e', textDecoration: 'none', display: 'flex' }}><I.ArrowLeft /></a>
          <div style={s.headerIcon}><I.Shield /></div>
          <div>
            <h2 style={s.title}>Respaldos</h2>
            <p style={s.subtitle}>v{info?.appVersion} - {info?.storageType}</p>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div style={s.cards}>
        <div style={s.card}>
          <div style={s.cardHead}><span style={{ ...s.dot, background: healthColor }} /><span style={s.cardLabel}>Estado</span></div>
          <p style={{ ...s.cardVal, color: healthColor }}>{health?.message}</p>
        </div>
        <div style={s.card}>
          <div style={s.cardHead}>{info?.googleDriveDetected ? <I.Cloud /> : <I.Folder />}<span style={s.cardLabel}>Ubicacion</span></div>
          <p style={s.cardVal}>{info?.storageType}</p>
          <p style={s.cardSub} title={info?.backupDirectory}>{info?.backupDirectory}</p>
        </div>
        <div style={s.card}>
          <div style={s.cardHead}><I.Database /><span style={s.cardLabel}>Resumen</span></div>
          <p style={s.cardVal}>{info?.totalBackups} respaldos - {info?.totalSizeMB} MB</p>
          {info?.lastBackup && <p style={s.cardSub}>Ultimo: {timeAgo(info.lastBackup.timestamp)}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button style={tab === 'smart' ? s.tabActive : s.tab} onClick={() => setTab('smart')}>
          <I.Database /> Respaldos inteligentes
        </button>
        <button style={tab === 'dumps' ? s.tabActive : s.tab} onClick={() => setTab('dumps')}>
          <I.HardDrive /> Dumps completos
        </button>
      </div>

      {/* TAB: Smart Backups */}
      {tab === 'smart' && (
        <div>
          <div style={s.toolbarRow}>
            <button
              style={{ ...s.btnPrimary, opacity: actionLoading === 'smart-create' ? 0.6 : 1 }}
              onClick={createSmartBackup}
              disabled={!!actionLoading}
            >
              <I.Download />
              <span style={{ marginLeft: 6 }}>{actionLoading === 'smart-create' ? 'Creando...' : 'Crear respaldo'}</span>
            </button>
            <button style={s.btnOutline} onClick={fetchInfo}><I.Refresh /></button>
          </div>
          <p style={s.hint}>
            Los respaldos inteligentes exportan datos en formato JSON. Son compatibles entre diferentes versiones de enLocal Caja.
          </p>
          {info?.backups?.length === 0 ? (
            <EmptyState message="No hay respaldos todavia" sub="Crea tu primer respaldo con el boton de arriba" />
          ) : (
            <div style={s.list}>
              {info?.backups?.map((b: any) => {
                const c = TIPO_COLORS[b.tipo] || { bg: '#F5F5F5', fg: '#616161', border: '#E0E0E0' }
                return (
                  <div key={b.filename} style={{ ...s.listItem, borderLeftColor: c.border }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.itemRow}>
                        <span style={{ ...s.badge, background: c.bg, color: c.fg, borderColor: c.border }}>
                          {TIPO_LABELS[b.tipo] || b.tipo}
                        </span>
                        <span style={s.versionTag}>v{b.appVersion}</span>
                        <span style={s.dateText}><I.Clock /> {fullDate(b.date)}</span>
                      </div>
                      <p style={s.meta}>{b.sizeMB} MB - {b.filename}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={s.btnSmall} onClick={() => previewRestore(b)} title="Ver compatibilidad"><I.Eye /></button>
                      <button style={s.btnSmall} onClick={() => setConfirmRestore(b)} title="Restaurar">
                        <I.Refresh /> <span style={{ marginLeft: 3 }}>Restaurar</span>
                      </button>
                      {b.tipo !== 'pre-restauracion' && (
                        <button style={s.btnSmallDanger} onClick={() => deleteBackup(b.filename)} title="Eliminar"><I.Trash /></button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Full Dumps */}
      {tab === 'dumps' && (
        <div>
          <div style={s.toolbarRow}>
            <button
              style={{ ...s.btnWarning, opacity: actionLoading === 'dump-create' ? 0.6 : 1 }}
              onClick={createFullDump}
              disabled={!!actionLoading}
            >
              <I.HardDrive />
              <span style={{ marginLeft: 6 }}>{actionLoading === 'dump-create' ? 'Generando...' : 'Generar dump completo'}</span>
            </button>
            <button style={s.btnOutline} onClick={fetchInfo}><I.Refresh /></button>
          </div>
          <div style={s.warningBox}>
            <I.Alert />
            <div style={{ marginLeft: 10 }}>
              <strong>Dumps completos (pg_dump)</strong>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                Incluyen el schema y todos los datos. Solo son compatibles con la <strong>misma version</strong> de enLocal Caja.
              </p>
            </div>
          </div>
          {(!info?.fullDumps || info.fullDumps.length === 0) ? (
            <EmptyState message="No hay dumps completos" sub="Genera uno para soporte tecnico o emergencias" />
          ) : (
            <div style={s.list}>
              {info.fullDumps.map((d: any) => (
                <div key={d.filename} style={{ ...s.listItem, borderLeftColor: '#FFB74D' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.itemRow}>
                      <span style={{ ...s.badge, background: '#FFF3E0', color: '#E65100', borderColor: '#FFCC80' }}>Dump completo</span>
                      <span style={s.versionTag}>v{d.appVersion}</span>
                      <span style={s.dateText}><I.Clock /> {fullDate(d.date)}</span>
                    </div>
                    <p style={s.meta}>{d.sizeMB} MB - {d.filename}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={s.btnSmall} onClick={() => restoreFullDump(d)} disabled={!!actionLoading} title="Restaurar dump completo">
                      <I.Refresh /> <span style={{ marginLeft: 3 }}>Restaurar</span>
                    </button>
                    <button style={s.btnSmallDanger} onClick={() => deleteBackup(d.filename, 'dump')} title="Eliminar"><I.Trash /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Subcomponents ──────────────────────────────────────────────

function PreviewRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ color: '#9e9e9e', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: 13, color: ok ? '#2E7D32' : '#1a1a2e' }}>{value}</span>
    </div>
  )
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#bdbdbd' }}>
      <I.Database />
      <p style={{ fontSize: 15, fontWeight: 600, color: '#9e9e9e', margin: '12px 0 4px' }}>{message}</p>
      <p style={{ fontSize: 13, margin: 0 }}>{sub}</p>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 880, margin: '0 auto', padding: '24px 20px', color: '#1a1a2e', position: 'relative' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 },
  spinner: { width: 32, height: 32, border: '3px solid #e0e0e0', borderTopColor: '#1565C0', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  toast: { position: 'fixed', top: 20, right: 20, display: 'flex', alignItems: 'center', padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 500, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.2)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 },
  modal: { background: '#fff', borderRadius: 16, padding: 32, maxWidth: 480, width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' },
  modalIconBox: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitle: { margin: '0 0 12px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
  modalText: { fontSize: 14, color: '#616161', lineHeight: 1.5, margin: '0 0 16px' },
  modalActions: { display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' },
  previewGrid: { margin: '12px 0' },
  previewWarning: { background: '#FFF3E0', borderRadius: 8, padding: 12, fontSize: 13, marginTop: 12 },
  previewInfo: { background: '#E3F2FD', borderRadius: 8, padding: 12, fontSize: 13, marginTop: 8 },
  previewOk: { background: '#E8F5E9', borderRadius: 8, padding: 12, fontSize: 13, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#2E7D32', fontWeight: 500 },
  tagList: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 },
  tagRed: { background: '#FFCDD2', color: '#C62828' },
  tagBlue: { background: '#BBDEFB', color: '#1565C0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1565C0, #0D47A1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#0D47A1' },
  subtitle: { margin: '2px 0 0', fontSize: 13, color: '#9e9e9e' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 },
  card: { background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #eee' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#757575' },
  cardLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: '#9e9e9e' },
  cardVal: { margin: 0, fontSize: 14, fontWeight: 600 },
  cardSub: { margin: '3px 0 0', fontSize: 11, color: '#bdbdbd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #f0f0f0', paddingBottom: 0 },
  tab: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', background: 'none', color: '#9e9e9e', fontSize: 14, fontWeight: 500, cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', background: 'none', color: '#0D47A1', fontSize: 14, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid #1565C0', marginBottom: -2 },
  toolbarRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' },
  hint: { fontSize: 13, color: '#9e9e9e', margin: '0 0 16px', lineHeight: 1.4 },
  warningBox: { display: 'flex', alignItems: 'flex-start', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#E65100', fontSize: 14 },
  list: { borderRadius: 12, border: '1px solid #eee', overflow: 'hidden', maxHeight: 500, overflowY: 'auto' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f5f5f5', borderLeft: '3px solid #e0e0e0', gap: 12 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid' },
  versionTag: { fontSize: 11, color: '#9e9e9e', background: '#f5f5f5', padding: '1px 6px', borderRadius: 4 },
  dateText: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9e9e9e' },
  meta: { margin: '4px 0 0', fontSize: 11, color: '#bdbdbd' },
  btnPrimary: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1565C0, #0D47A1)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(21,101,192,.3)' },
  btnWarning: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #E65100, #BF360C)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(230,81,0,.3)' },
  btnOutline: { display: 'flex', alignItems: 'center', padding: '10px 16px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff', color: '#424242', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#C62828', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSmall: { display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', color: '#424242', fontSize: 12, cursor: 'pointer' },
  btnSmallDanger: { display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, border: '1px solid #ffcdd2', background: '#fff', color: '#C62828', fontSize: 12, cursor: 'pointer' },
}
