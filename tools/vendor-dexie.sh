#!/usr/bin/env bash
set -euo pipefail

VENDOR_DIR="$(cd "$(dirname "$0")/../public/src/vendor" && pwd)"
DEXIE_VERSION="${DEXIE_VERSION:-4.0.10}"
TARGET_MJS="$VENDOR_DIR/dexie.min.mjs"

echo "Downloading Dexie v$DEXIE_VERSION (ESM build)..."

declare -a URLS=(
  "https://cdn.jsdelivr.net/npm/dexie@${DEXIE_VERSION}/dist/dexie.min.mjs"
  "https://unpkg.com/dexie@${DEXIE_VERSION}/dist/dexie.min.mjs"
  "https://cdn.jsdelivr.net/npm/dexie@${DEXIE_VERSION}/dist/dexie.mjs"
  "https://unpkg.com/dexie@${DEXIE_VERSION}/dist/dexie.mjs"
)

for url in "${URLS[@]}"; do
  if curl -fsSL "$url" -o "$TARGET_MJS"; then
    if head -c 200 "$TARGET_MJS" | grep -q "Dexie"; then
      echo "OK: $TARGET_MJS ($(wc -c < "$TARGET_MJS") bytes)"
      exit 0
    fi
    echo "Downloaded but does not look like Dexie, retrying..."
  fi
done

echo "ERROR: failed to download Dexie ESM build"
exit 1
