// Mac only (Squirrel.Mac wants a signed app): downloads a new version in the background, then lets the user restart into it.
// The feed is update.electronjs.org, which reads the GitHub releases of the repo.
function setup({ autoUpdater, feed, onChange }) {
  autoUpdater.setFeedURL({ url: feed })
  autoUpdater.on('update-available', () => onChange({ state: 'downloading' }))
  autoUpdater.on('update-not-available', () => onChange(null))
  autoUpdater.on('update-downloaded', (_, notes, name) => onChange({ state: 'ready', name }))
  autoUpdater.on('error', e => onChange({ state: 'error', error: e.message }))
  return { check: () => autoUpdater.checkForUpdates(), install: () => autoUpdater.quitAndInstall() }
}

module.exports = { setup }
