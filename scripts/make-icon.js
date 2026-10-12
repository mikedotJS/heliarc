// Renders assets/icon.svg -> assets/icon.png (512, transparent). Run: npx electron scripts/make-icon.js
// Transparency is recovered by rendering on black and on white and solving for alpha.
const { app, BrowserWindow, nativeImage } = require('electron'), fs = require('fs'), path = require('path')
const S = 512, root = path.join(__dirname, '..', 'assets')
const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8')

let w
async function shot(bg) {
  w ||= new BrowserWindow({ width: S, height: S, show: false, useContentSize: true, frame: false, webPreferences: { offscreen: true } })
  const f = path.join(require('os').tmpdir(), 'heliarc-icon-' + bg.slice(1) + '.html')
  fs.writeFileSync(f, `<style>html,body{margin:0;overflow:hidden;background:${bg}}svg{display:block;width:${S}px;height:${S}px}</style>${svg}`)
  await w.loadFile(f)
  await new Promise(r => setTimeout(r, 600))
  const img = await w.webContents.capturePage()
  return { buf: img.toBitmap(), size: img.getSize() }
}

app.whenReady().then(async () => {
  const [k, w] = [await shot('#000'), await shot('#fff')]
  if (k.size.width !== w.size.width) throw new Error('size mismatch')
  const out = Buffer.alloc(k.buf.length)
  for (let i = 0; i < out.length; i += 4) {
    const a = Math.min(1, Math.max(0, 1 - (w.buf[i] - k.buf[i]) / 255))
    for (let c = 0; c < 3; c++) out[i + c] = a > 0.01 ? Math.min(255, Math.round(k.buf[i + c] / a)) : 0
    out[i + 3] = Math.round(a * 255)
  }
  fs.writeFileSync(path.join(root, 'icon.png'), nativeImage.createFromBitmap(out, k.size).toPNG())
  app.quit()
})
