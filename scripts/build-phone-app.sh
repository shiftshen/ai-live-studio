#!/bin/sh
# Silent, bounded phone projection. Never mixes the phone's feed into the live audio.
set -eu
cd "$(dirname "$0")/.."
app="$(pwd)/var/vendor/AI Live Phone.app"
command -v scrcpy >/dev/null
command -v adb >/dev/null
mkdir -p "$app/Contents/MacOS"
cat > "$app/Contents/MacOS/scrcpy" <<'SCRIPT'
#!/bin/sh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
exec scrcpy --no-audio --max-fps=15 --max-size=1000 --window-title='AI Live Phone · 无音频'
SCRIPT
chmod +x "$app/Contents/MacOS/scrcpy"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>scrcpy</string><key>CFBundleIdentifier</key><string>local.shift.ai-live-phone</string><key>CFBundleName</key><string>AI Live Phone</string></dict></plist>
PLIST
printf '%s\n' "$app"
