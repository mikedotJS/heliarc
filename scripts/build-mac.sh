#!/bin/zsh
# Builds Heliarc.app (run on a Mac, from the project folder): npm run package:mac
set -e
cd "$(dirname "$0")/.."
rm -rf build && mkdir -p build/icon.iconset
for s in 16 32 64 128 256 512; do
  sips -z $s $s assets/icon.png --out build/icon.iconset/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) assets/icon.png --out build/icon.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns build/icon.iconset -o build/icon.icns
npx --yes @electron/packager . Heliarc --platform=darwin --arch=$(uname -m | sed 's/x86_64/x64/') --out=dist --overwrite \
  --icon=build/icon --app-bundle-id=app.heliarc.browser --app-category-type=public.app-category.productivity \
  --ignore='^/(dist|build|motion-.*|shot-.*|screenshot.*|\.gitignore)'
APP=$(ls -d dist/Heliarc-darwin-*/Heliarc.app)
cp build/icon.icns "$APP/Contents/Resources/electron.icns"
codesign --force --deep --sign - "$APP"
echo "Built: $APP"
