// Switches off the Electron features a browser doesn't need (an attacker with a copy of the app could use them to run code as Heliarc):
// node scripts/fuses.js <Heliarc.exe or Heliarc.app>. Runs before signing, since it edits the binary.
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

flipFuses(process.argv[2], {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false, // ELECTRON_RUN_AS_NODE would turn the app into a plain Node interpreter
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // NODE_OPTIONS=--require evil.js
  [FuseV1Options.EnableNodeCliInspectArguments]: false, // --inspect opens a debugger anyone on the machine can attach to
  resetAdHocDarwinSignature: process.platform === 'darwin' && process.arch === 'arm64',
}).then(() => console.log('fuses flipped:', process.argv[2])).catch(e => { console.error(e); process.exit(1) })
