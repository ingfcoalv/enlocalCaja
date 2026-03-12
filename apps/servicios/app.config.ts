export default {
  appId: 'enlocal-servicios',
  appName: 'enLocal Servicios',
  electronAppId: 'com.todoenlocal.servicios',
  port: 9004,
  dbName: 'enlocal_servicios',
  multiuser: true,
  cloudApiUrl: 'https://todoenlocal.com',
  updateServer: 'https://updates.todoenlocal.com/servicios',
  icon: './assets/icon.png',
  color: '#ea580c',
  modules: {
    default: ['mod-config', 'mod-catalogs', 'mod-appointments', 'mod-invoicing', 'mod-reports', 'mod-quotes'],
    addons: ['mod-inventory', 'mod-pos'],
  },
}
