const { app } = require('electron'), fs = require('fs'), path = require('path')
// Tiny JSON persistence in the user data folder: one file per name. Writes are throttled (at most one per 500 ms
// however busy the app is), atomic (temp file + rename) and flushed on quit.
const file = n => path.join(app.getPath('userData'), n + '.json'), timers = {}, pending = {}
const load = (n, def) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')) } catch { return def } }
const flush = n => {
  if (!(n in pending)) return
  clearTimeout(timers[n]); delete timers[n]
  try { fs.writeFileSync(file(n) + '.tmp', JSON.stringify(pending[n])); fs.renameSync(file(n) + '.tmp', file(n)) } catch {}
  delete pending[n]
}
const save = (n, v) => { pending[n] = v; timers[n] ??= setTimeout(() => flush(n), 500) }
const flushAll = () => Object.keys(pending).forEach(flush)
module.exports = { load, save, flushAll }
