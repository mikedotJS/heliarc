// Captures mid-animation frames to prove motion runs. Run: npx electron . --motioncheck
const fs = require('fs'), sleep = ms => new Promise(r => setTimeout(r, ms))
module.exports = async a => {
  const snap = async (v, n) => fs.writeFileSync(`motion-${n}.png`, (await v.webContents.capturePage()).toPNG())
  await sleep(2500); a.newTab('https://example.com'); await sleep(2500)
  a.openCmd('new'); await sleep(40); await snap(a.cmd(), 'cmd-040ms'); await sleep(120); await snap(a.cmd(), 'cmd-160ms'); await sleep(700); await snap(a.cmd(), 'cmd-end')
  a.closeCmd(); await sleep(300)
  a.switchSpace(2); await sleep(150); await snap(a.ui(), 'space-150ms'); await sleep(900); await snap(a.ui(), 'space-end')
  process.exit(0)
}
