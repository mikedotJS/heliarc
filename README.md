# Heliarc

A private, Arc-style desktop browser prototype built with Electron.

Inspired by the open-source [Helium](https://github.com/imputnet/helium) browser (privacy-first, built-in ad blocking, bangs) and the Arc browser's interface. Not affiliated with either project.

- Vertical sidebar with pinned tabs and colored Spaces
- Command bar (Ctrl/Cmd+T), bangs (`!w cats`, `!yt lofi`, `!gh electron`, `!g`, `!ddg`)
- Built-in ad and tracker blocking ([Ghostery adblocker](https://github.com/ghostery/adblocker)), Global Privacy Control and Do Not Track headers, permissions denied by default
- Tab hibernation, per-tab mute

## Run

    npm install
    npm start

Shortcuts: Ctrl/Cmd+T new tab, Ctrl/Cmd+L edit address, Ctrl/Cmd+W close tab.

## Test

    npm test        # end-to-end self test against real sites (needs network)

## Package for macOS

    npm run package:mac   # builds dist/Heliarc-darwin-*/Heliarc.app (run on a Mac)

Icons: [Lucide](https://lucide.dev) (ISC). Regenerate with `npm run icons`.

## License

GPL-3.0
