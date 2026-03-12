import { startServer } from './electron/server'

startServer({
  port: 9005,
  dbName: 'enlocal_caja',
  enabledModules: ['mod-config', 'mod-catalogs', 'mod-pos', 'mod-reports', 'mod-invoicing', 'mod-inventory', 'mod-remissions', 'mod-quotes', 'mod-payables'],
  multiuser: false,
}).then(() => {
  console.log('[dev] enLocal Caja backend running on http://127.0.0.1:9005')
})
