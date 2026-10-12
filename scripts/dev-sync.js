// Copies every saved source file to the dev copy on the Mac, whose running app reloads itself (see the dev watcher in main.js).
// Run on the machine you edit on: node scripts/dev-sync.js [host] [remote folder]
const { execFile } = require('child_process'), fs = require('fs'), path = require('path')
const root = path.join(__dirname, '..'), host = process.argv[2] || 'mac-mike', remote = process.argv[3] || 'heliarc-dev'
const queue = new Set(); let timer
fs.watch(root, { recursive: true }, (_, f) => {
  if (!f || /node_modules|\.git|dist|build|\.png$|selftest|\.tmp\./.test(f) || !fs.existsSync(path.join(root, f)) || fs.statSync(path.join(root, f)).isDirectory()) return
  queue.add(f.replace(/\\/g, '/')); clearTimeout(timer)
  timer = setTimeout(() => { for (const rel of queue) execFile('scp', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', path.join(root, rel), `${host}:${remote}/${rel}`], e => console.log(e ? '✗ ' + rel + ' ' + e.message : '→ ' + rel)); queue.clear() }, 300)
})
console.log(`syncing ${root} → ${host}:${remote}`)
