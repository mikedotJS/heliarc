// Builds dist/Heliarc-win32-x64/ (Heliarc.exe) and dist/Heliarc-windows-x64.zip. Run: npm run package:win
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const root = path.join(__dirname, '..')
;(async () => {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true })
  const pngToIco = (await import('png-to-ico')).default, { packager } = await import('@electron/packager')
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), await pngToIco([path.join(root, 'assets', 'icon.png')]))
  fs.rmSync(path.join(root, 'dist', 'Heliarc-win32-x64'), { recursive: true, force: true, maxRetries: 20, retryDelay: 500 }) // antivirus can briefly lock a fresh build
  await packager({
    dir: root, name: 'Heliarc', platform: 'win32', arch: 'x64', out: path.join(root, 'dist'), overwrite: true, icon: path.join(root, 'build', 'icon.ico'),
    ignore: [/^\/(dist|build|motion-.*|shot-.*|screenshot.*|site|\.git|\.github|\.gitignore)/],
  })
  const zip = path.join(root, 'dist', 'Heliarc-windows-x64.zip')
  fs.rmSync(zip, { force: true })
  execFileSync('tar', ['-a', '-c', '-f', zip, '-C', path.join(root, 'dist'), 'Heliarc-win32-x64'], { stdio: 'inherit' }) // bsdtar writes a zip for a .zip name
  console.log('Built:', zip)
})().catch(e => { console.error(e); process.exit(1) })
