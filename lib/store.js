const { app } = require('electron'), fs = require('fs'), path = require('path')
// Tiny JSON persistence in the user data folder: one file per name. Writes are throttled (at most one per 500 ms
// however busy the app is), atomic (temp file + rename) and flushed on quit.
const file = n => path.join(app.getPath('userData'), n + '.json'), timers = {}, pending = {}
const load = (n, def) => {
  let text; try { text = fs.readFileSync(file(n), 'utf8') } catch { return def }
  try { return JSON.parse(text) } catch { try { fs.renameSync(file(n), file(n) + '.corrupt') } catch {} return def } // unreadable: keep it aside instead of overwriting it with the defaults
}
const flush = n => {
  if (!(n in pending)) return
  clearTimeout(timers[n]); delete timers[n]
  try { // the data stays pending when the write fails, so the next save or the flush on quit tries again
    const fd = fs.openSync(file(n) + '.tmp', 'w')
    try { fs.writeFileSync(fd, JSON.stringify(pending[n])); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    fs.renameSync(file(n) + '.tmp', file(n)); delete pending[n]
  } catch {}
}
const save = (n, v) => { pending[n] = v; timers[n] ??= setTimeout(() => flush(n), 500) }
const flushAll = () => Object.keys(pending).forEach(flush)
module.exports = { load, save, flushAll }
