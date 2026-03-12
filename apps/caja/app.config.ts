export default {
  appId: 'enlocal-caja',
  appName: 'enLocal Caja',
  electronAppId: 'com.todoenlocal.caja',
  productCode: 'enlocal_caja',
  port: 8214,
  pgPort: 5433,
  dbName: 'enlocal_caja',
  multiuser: false,
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://todoenlocal.com/api/v1/software/caja',
  icon: './assets/icon.png',
  color: '#16a34a',
  modules: {
    default: ['mod-config', 'mod-catalogs', 'mod-pos', 'mod-reports', 'mod-inventory'],
    addons: ['mod-invoicing', 'mod-quotes', 'mod-remissions', 'mod-payables'],
  },
}
