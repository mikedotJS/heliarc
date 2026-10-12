// Signs (Developer ID, hardened runtime) and notarizes a packaged Heliarc.app: node scripts/sign-mac.js <path to .app>
// Needs the Developer ID certificate in the keychain and APPLE_ID, APPLE_APP_PASSWORD, APPLE_TEAM_ID in the environment.
const { signAsync } = require('@electron/osx-sign')
const { notarize } = require('@electron/notarize')

const appPath = process.argv[2]
const { APPLE_ID: appleId, APPLE_APP_PASSWORD: appleIdPassword, APPLE_TEAM_ID: teamId } = process.env
;(async () => {
  await signAsync({
    app: appPath,
    identity: `Developer ID Application`,
    optionsForFile: () => ({ hardenedRuntime: true, entitlements: require('path').join(__dirname, 'entitlements.plist') }),
  })
  await notarize({ appPath, appleId, appleIdPassword, teamId }) // also staples the ticket
  console.log('signed and notarized:', appPath)
})().catch(e => { console.error(e); process.exit(1) })
