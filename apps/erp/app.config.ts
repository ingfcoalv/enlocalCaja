export default {
  appId: 'enlocal-erp',
  appName: 'enLocal ERP',
  electronAppId: 'com.todoenlocal.erp',
  port: 9003,
  dbName: 'enlocal_erp',
  multiuser: true,
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://updates.todoenlocal.com/erp',
  icon: './assets/icon.png',
  color: '#7c3aed',
  modules: {
    default: [
      'mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-inventory',
      'mod-pos', 'mod-payroll', 'mod-reports', 'mod-quotes',
    ],
    addons: ['mod-appointments'],
  },
}
