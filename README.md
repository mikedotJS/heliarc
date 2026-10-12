# Heliarc

A private, Arc-style desktop browser prototype built with Electron.

Inspired by the open-source [Helium](https://github.com/imputnet/helium) browser (privacy-first, built-in ad blocking, bangs) and the Arc browser's interface. Not affiliated with either project.

**Privacy**
- Built-in ad and tracker blocking ([Ghostery adblocker](https://github.com/ghostery/adblocker)), Global Privacy Control and Do Not Track headers, permissions denied by default
- Command bar (Ctrl/Cmd+T), bangs (`!w cats`, `!yt lofi`, `!gh electron`, `!g`, `!ddg`)

**Browser basics**
- Tabs and session are saved: reopen the app and everything is back (only the active tab loads, the rest wake up when selected)
- Find in page, zoom, history, downloads (sidebar card + Library), print, developer tools (F12)
- Chrome extensions from the Chrome Web Store (Extensions panel). Content scripts and background logic work; toolbar buttons/popups and some APIs (e.g. declarativeNetRequest) don't
- Password manager (encrypted with the OS keychain: asks to save after a login, fills on focus) and address autofill

**Arc-style**
- Vertical sidebar: favorites on top (shared by every space), pinned tabs, folders, then today's tabs; drag & drop between all of them
- Spaces (Home / Work / Fun), each with its own cookies and logins; links can be routed to a space (Settings, or right-click a tab → *Always open … in*)
- Split view (two pages side by side), Peek (Shift+click a link), Little window for links from other apps (set Heliarc as default browser in Settings), automatic archive of unused tabs (12 h by default, see Library → Archive)
- Automatic picture-in-picture when you leave a playing video tab, mini player in the sidebar, collapsible sidebar (hover the left edge to peek at it)
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

Get the latest Windows and Mac builds from [Releases](https://github.com/mikedotJS/heliarc/releases). They aren't code-signed yet: on Windows click *More info* → *Run anyway*; on Mac right-click the app → *Open* the first time.

## Package it yourself

    npm run package:win   # builds dist/Heliarc-windows-x64.zip (run on Windows)
    npm run package:mac   # builds dist/Heliarc-mac-<arch>.zip (run on a Mac; ARCH=x64 or arm64)

Pushing a tag like `v0.2.0` builds both and publishes the GitHub release (`.github/workflows/release.yml`).

Icons: [Lucide](https://lucide.dev) (ISC). Regenerate with `npm run icons`. Drag & drop: [SortableJS](https://sortablejs.github.io/Sortable/). Extension unpacking: [fflate](https://github.com/101arrowz/fflate).

## License

GPL-3.0
