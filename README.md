# Heliarc

A private, Arc-style desktop browser prototype built with Electron.

Inspired by the open-source [Helium](https://github.com/imputnet/helium) browser (privacy-first, built-in ad blocking, bangs) and the Arc browser's interface. Not affiliated with either project.

**Privacy**
- Built-in ad and tracker blocking ([Ghostery adblocker](https://github.com/ghostery/adblocker)) with a choice of filter lists, and, from the shield at the bottom of the sidebar, a switch per site for ads, third-party cookies, the hardware masking and the WebRTC protection (some sign-ins or calls need one of them off)
- Third-party cookies blocked, HTTPS used whenever the site supports it, WebRTC doesn't reveal your local address, no speculative page loading, Global Privacy Control and Do Not Track headers
- Locked-down app: its own screens run no remote or injected code and can't be sent elsewhere, and the packaged app switches off the Electron features that would let someone run code through it. Dependencies and secrets are checked in CI: see [SECURITY.md](SECURITY.md)
- Fingerprint hardening: sites see a plain Chrome with common hardware (the browser identity changes right away; the hardware values apply to tabs opened from now on)
- Sites ask before using your camera, microphone, location, notifications, clipboard, MIDI or files, before opening another app (mailto:, spotify:…), and before sharing your screen or reaching a USB, serial or Bluetooth device; invalid certificates show a warning first. What you chose to remember is listed in Settings
- A **Private** space (⌘⇧N / Ctrl+Shift+N): in memory only, no history, no saved tabs, no extensions, wiped when its last tab closes. Optional "clear everything when I quit"
- Web page files open too: paste a file path in the address bar, or use Open with… (on Mac, Heliarc is offered for .html files)
- Sign-in windows ("Sign in with Google / Apple…") open as real windows that stay linked to the page, so the login completes
- Command bar (Ctrl/Cmd+T) that finishes the address of a site you already visited as you type (Tab or → to accept), a choice of search engines, bangs (`!w cats`, `!yt lofi`, `!gh electron`, `!g`, `!ddg`) and your own bangs

**Browser basics**
- Tabs and session are saved: reopen the app and everything is back (only the active tab loads, the rest wake up when selected)
- Proper screens inside the tab when something goes wrong: page can't load (address not found, connection refused, timeout), offline (reloads by itself when the connection is back), crashed tab, invalid certificate, a card over a page that stops responding, a failed download (with Retry) and an extension that won't start (with Retry); Peek and the Little window get the same screens
- A small design system (tokens, components, light and dark, a showcase page and an automatic guard): see [DESIGN.md](DESIGN.md)
- Find in page, zoom, history, downloads (sidebar card + Library), print, developer tools (F12), spell check with suggestions
- Chrome extensions from the Chrome Web Store (an "Add to Heliarc" button on the store pages, or Settings → Extensions), with toolbar buttons, popups, keyboard shortcuts and context-menu entries. Password managers such as Bitwarden and Proton Pass run. Not supported: `declarativeNetRequest` (the built-in blocker covers ad blocking)
- Password manager (encrypted with the OS keychain: asks to save after a login, fills on focus) and address autofill
- Import history, bookmarks and saved passwords from Chrome, Edge, Brave and Arc (on Mac, macOS asks you to allow access to the browser's key; on Windows, recent Chrome and Edge lock their passwords to themselves, so export a CSV from them), history and bookmarks from Firefox and Safari, or anything from exported files; Firefox and Safari passwords come in from a CSV you export (Settings → Import)
- Swipe two fingers on a page for back / forward, or on the sidebar to change space. On Mac the app updates itself in the background and asks you to restart; on Windows a notice appears in the sidebar when a newer release is out
- AI assistants can drive Heliarc over [MCP](https://modelcontextprotocol.io) (Settings → *AI assistants*, off by default): list, open, switch, close, pin, favorite, move and sleep tabs, read a page, wait for text, click, type, pick drop-down options, scroll, screenshot, search history, list downloads. Local only (127.0.0.1), protected by a secret token, and the Private space is never reachable. In Claude Code: copy the command shown in Settings

- **Ask Heliarc** (Settings → *AI assistants*, off by default): type a sentence in the command bar (⌘L) and press Tab, or start with ?, and Heliarc does it in your browser with your own Claude API key (kept encrypted by the system). It shows each step, can be stopped, asks before any click that sends, pays, deletes or publishes, never types passwords and never sees the Private space
**Not there yet**: Netflix/Spotify-style protected video (Widevine needs a different Electron build), passkeys.

**Arc-style**
- Vertical sidebar: favorites on top (shared by every space), pinned tabs, folders, then today's tabs; drag & drop between all of them
- Spaces (Home / Work / Fun), each with its own cookies and logins; links can be routed to a space (Settings, or right-click a tab → *Always open … in*): new tabs, typed addresses and links from other apps follow the route
- Split view (two pages side by side), Peek (Shift+click a link), Little window for links from other apps (set Heliarc as default browser in Settings), automatic archive of unused tabs (12 h by default, see Library → Archive)
- Automatic picture-in-picture when you leave a playing video tab, mini player in the sidebar, collapsible sidebar (hover its edge to peek at it), on the left or the right; rename spaces and pick their icon and colours in Settings
- Every shortcut can be changed in Settings

## Run

    npm install
    npm start

Shortcuts are shown for your system (Ctrl+Shift+S on Windows, ⌘⇧S on Mac) and can all be changed in Settings. Defaults (Mod = Ctrl, or ⌘ on Mac): Mod+T new tab · L edit address · W close tab · R reload · F find · = / − / 0 zoom · S collapse sidebar · Shift+S split view · P print · Shift+I developer tools · , settings · History: Ctrl+H on Windows, ⌘Y on Mac · Library: Ctrl+J on Windows, ⌘⇧J on Mac.

## Test

    npm test              # end-to-end self test (needs network: ad blocker lists, Chrome Web Store)
    npm run test:local    # offline feature tests against a local server

Tests use a throwaway profile and download folder. Screenshots land in your temp folder (`heliarc-shots`).
To check session restore across launches, run `test:local` once with `HELIARC_USER_DATA=<dir>`, then again with the same value plus `HELIARC_EXPECT_RESTORE=1`.

## Download

Get the latest Windows and Mac builds from [Releases](https://github.com/mikedotJS/heliarc/releases). The Mac builds are signed and notarized by Apple, so they open like any other app; the Windows builds aren't code-signed yet (click *More info* → *Run anyway*). On Mac the easiest way is one line in Terminal, which installs the latest version and opens it:

    curl -fsSL https://raw.githubusercontent.com/mikedotJS/heliarc/main/scripts/install-mac.sh | zsh

If you downloaded the zip from your browser instead (macOS 15 and later), run `xattr -dr com.apple.quarantine /Applications/Heliarc.app` once in Terminal, or open *System Settings → Privacy & Security* and click *Open Anyway* after the first blocked launch.

## Package it yourself

    npm run package:win   # builds dist/Heliarc-windows-x64.zip (run on Windows)
    npm run package:mac   # builds dist/Heliarc-mac-<arch>.zip (run on a Mac; ARCH=x64 or arm64)

Pushing a tag like `v0.2.0` builds both and publishes the GitHub release (`.github/workflows/release.yml`).

Icons: [Lucide](https://lucide.dev) (ISC). Regenerate with `npm run icons`. Drag & drop: [SortableJS](https://sortablejs.github.io/Sortable/). Extension unpacking: [fflate](https://github.com/101arrowz/fflate).

## License

GPL-3.0
