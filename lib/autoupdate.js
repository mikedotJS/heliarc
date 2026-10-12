// Mac only (Squirrel.Mac wants a signed app): downloads a new version in the background, then lets the user restart into it.
// The feed is update.electronjs.org, which reads the GitHub releases of the repo.
function setup({ autoUpdater, feed, onChange }) {
  autoUpdater.setFeedURL({ url: feed })
  autoUpdater.on('update-available', () => onChange({ state: 'downloading' }))
  autoUpdater.on('update-not-available', () => onChange(null))
  autoUpdater.on('update-downloaded', (_, notes, name) => onChange({ state: 'ready', name }))
  autoUpdater.on('error', e => onChange({ state: 'error', error: e.message }))
  // resolves to true when a download starts, false when there is nothing to download or the feed fails
  const check = () => new Promise(done => {
    autoUpdater.once('update-available', () => done(true)); autoUpdater.once('update-not-available', () => done(false)); autoUpdater.once('error', () => done(false))
    autoUpdater.checkForUpdates()
  })
  return { check, install: () => autoUpdater.quitAndInstall() }
}

module.exports = { setup }
