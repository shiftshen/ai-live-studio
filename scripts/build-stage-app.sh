#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
root=$(pwd)
app="$root/var/vendor/AI Live Stage.app"
mkdir -p "$app/Contents/MacOS"
swiftc src/native/LiveStage.swift -o "$app/Contents/MacOS/LiveStage" -framework Cocoa -framework WebKit
cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>LiveStage</string><key>CFBundleIdentifier</key><string>local.shift.ai-live-stage</string><key>CFBundleName</key><string>AI Live Stage</string><key>NSHighResolutionCapable</key><true/><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>
PLIST
printf '%s\n' "$app"
