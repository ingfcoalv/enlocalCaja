export default {
  appId: 'enlocal-nominas',
  appName: 'enLocal Nóminas',
  electronAppId: 'com.todoenlocal.nominas',
  port: 9002,
  dbName: 'enlocal_nominas',
  multiuser: false,
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://updates.todoenlocal.com/nominas',
  icon: './assets/icon.png',
  color: '#0891b2',
  modules: {
    default: ['mod-config', 'mod-catalogs', 'mod-payroll', 'mod-reports'],
    addons: ['mod-invoicing'],
  },
}
