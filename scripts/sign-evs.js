// VMP-signs a packaged Heliarc with castLabs EVS so streaming sites (TF1+, Netflix, Disney+ ...) hand out Widevine licenses:
// node scripts/sign-evs.js <folder holding Heliarc.app or Heliarc.exe>
// Argument: the package folder. Run it after every edit of the binaries (fuses) and, on Mac, before the final codesign.
// Needs `pip install castlabs-evs` and EVS_ACCOUNT_NAME + EVS_PASSWD in the environment (or an earlier `python -m castlabs_evs.account reauth` on this machine).
const { spawnSync } = require('child_process')

const pkg = process.argv[2], { EVS_ACCOUNT_NAME: account, EVS_PASSWD: passwd } = process.env
const args = ['-m', 'castlabs_evs.vmp', '-n', 'sign-pkg', ...(account && passwd ? ['-A', account, '-P', passwd] : []), pkg]
const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', args, { stdio: 'inherit' })
if (r.status === 0) console.log('EVS signed:', pkg)
else if (account) process.exit(r.status || 1) // credentials given: a failed signature must fail the build
else console.warn('WARNING: not EVS-signed (no EVS_ACCOUNT_NAME, or signing failed above): the app runs, but TF1+, Netflix and other DRM videos will refuse to play')
