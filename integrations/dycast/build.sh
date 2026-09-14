#!/usr/bin/env bash
set -euo pipefail
integration_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$integration_dir/../.." && pwd)"
commit=70050e27092fc726e3f7c84339b0edfd36d70130
build_dir="${DYCAST_BUILD_DIR:-$project_dir/var/build/dycast-$commit}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$project_dir/var/build/dycast-target}"
if [[ ! -d "$build_dir/.git" ]]; then
  mkdir -p "$(dirname "$build_dir")"
  git clone https://github.com/qinant/dycast-desktop.git "$build_dir"
  git -C "$build_dir" checkout --detach "$commit"
fi
[[ "$(git -C "$build_dir" rev-parse HEAD)" == "$commit" ]] || { echo 'Unexpected upstream revision' >&2; exit 1; }
if git -C "$build_dir" apply --check "$integration_dir/public-fields.patch" 2>/dev/null; then
  git -C "$build_dir" apply "$integration_dir/public-fields.patch"
else
  git -C "$build_dir" apply --reverse --check "$integration_dir/public-fields.patch"
fi
if git -C "$build_dir" apply --check "$integration_dir/relay-order.patch" 2>/dev/null; then
  git -C "$build_dir" apply "$integration_dir/relay-order.patch"
else
  git -C "$build_dir" apply --reverse --check "$integration_dir/relay-order.patch"
fi
cd "$build_dir"
npm ci --no-audit --no-fund
node "$integration_dir/test-public-fields.mjs" "$build_dir"
node "$integration_dir/test-relay-order.mjs" "$build_dir"
npm run tauri -- build --config "$integration_dir/build-config.json" --bundles app --ci -- --locked
app_source="$CARGO_TARGET_DIR/release/bundle/macos/Dycast AI Live Studio.app"
app_destination="${DYCAST_APP_DESTINATION:-$project_dir/var/vendor/Dycast AI Live Studio.app}"
[[ ! -e "$app_destination" ]] || { echo "Refusing to overwrite $app_destination" >&2; exit 1; }
mkdir -p "$(dirname "$app_destination")"
ditto "$app_source" "$app_destination"
codesign --force --deep --sign - "$app_destination"
codesign --verify --deep --strict "$app_destination"
echo "$app_destination"
