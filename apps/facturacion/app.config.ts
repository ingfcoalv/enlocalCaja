export default {
  appId: 'enlocal-facturacion',
  appName: 'enLocal Facturación',
  electronAppId: 'com.todoenlocal.facturacion',
  port: 9001,
  dbName: 'enlocal_facturacion',
  multiuser: false,
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://updates.todoenlocal.com/facturacion',
  icon: './assets/icon.png',
  color: '#2563eb',
  modules: {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-reports'],
    addons: ['mod-inventory', 'mod-pos', 'mod-quotes'],
  },
}
