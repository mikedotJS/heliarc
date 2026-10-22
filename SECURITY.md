# Security

## Report a problem
Open a private report: GitHub → Security → "Report a vulnerability" on `mikedotJS/heliarc`. Please don't open a public issue for a vulnerability.

## What protects you
- Web pages run sandboxed and isolated, with no access to the app's internals; only Heliarc's own screens talk to the app.
- Camera, microphone, location and the like are denied unless you allow them for that site.
- HTTP links are upgraded to HTTPS; an invalid certificate shows a warning screen.
- The Mac app is signed with a Developer ID and notarized; updates come from the signed GitHub releases.
- Electron features a browser doesn't need (run as Node, `NODE_OPTIONS`, `--inspect`) are switched off in the packaged app.
- CI scans for leaked secrets, vulnerable dependencies and risky code on every push and every week.

## Known and accepted
- `npm audit` reports `braces`/`micromatch` through `patch-package`. They are build-time tools only (never shipped, and they only read our own patch files) and no fixed version exists.
- The main UI view is not sandboxed because the extension toolbar needs it; it never loads remote content and is locked to the app's own files.
- The Mac app keeps the `disable-library-validation` entitlement (with `allow-jit` and `allow-unsigned-executable-memory`, which Electron needs). Removing it would be safer but must be tried on a signed build first.

## Not covered yet
- No hands-on attack test beyond the automated ones (opening windows, leaving the app's files, running eval from an app screen).
