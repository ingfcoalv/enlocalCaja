import { autoUpdater } from 'electron-updater'

export type UpdateChannel = 'beta' | 'latest'

export function setUpdateChannel(channel: UpdateChannel): void {
  autoUpdater.channel = channel
  autoUpdater.allowPrerelease = channel === 'beta'
}

export function getUpdateChannel(): UpdateChannel {
  return (autoUpdater.channel as UpdateChannel) || 'latest'
}
