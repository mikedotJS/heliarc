#!/bin/zsh
# Installs the latest Heliarc into /Applications.
#   curl -fsSL https://raw.githubusercontent.com/mikedotJS/heliarc/main/scripts/install-mac.sh | zsh
# Files fetched by curl aren't marked as downloaded from a browser, so macOS doesn't block the not-yet-notarized app.
set -e
ARCH=$(uname -m | sed 's/x86_64/x64/')
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading Heliarc for $ARCH…"
curl -fL --progress-bar -o "$TMP/heliarc.zip" "https://github.com/mikedotJS/heliarc/releases/latest/download/Heliarc-mac-$ARCH.zip"
ditto -x -k "$TMP/heliarc.zip" "$TMP"
osascript -e 'tell application "Heliarc" to quit' >/dev/null 2>&1 || true
rm -rf /Applications/Heliarc.app
ditto "$TMP/Heliarc.app" /Applications/Heliarc.app
xattr -dr com.apple.quarantine /Applications/Heliarc.app 2>/dev/null || true
echo "Installed. Opening Heliarc…"
open /Applications/Heliarc.app
