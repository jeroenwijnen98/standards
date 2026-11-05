#!/usr/bin/env bash
# install.sh [--app]: link `mini-ui` into ~/.local/bin. With --app (on the
# mini) also build ~/Applications/MiniUI.app and sign it with a local
# self-signed identity, so a rebuild keeps its Accessibility and Screen
# Recording grants. The identity lives in its own keychain, unlocked with a
# generated password, so this runs unattended over ssh.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HOME/.local/bin"
ln -sf "$here/mini-ui" "$HOME/.local/bin/mini-ui"
echo "linked ~/.local/bin/mini-ui"
[[ ${1:-} == --app ]] || exit 0

KC="$HOME/Library/Keychains/mini-ui.keychain-db"
PASS_FILE="$HOME/.config/mini-ui/keychain-pass"
IDENTITY="MiniUI Local Signing"
APP="$HOME/Applications/MiniUI.app"

if [[ ! -f $KC ]]; then
  mkdir -p "$(dirname "$PASS_FILE")"
  (umask 077 && /usr/bin/openssl rand -hex 24 >"$PASS_FILE")
  security create-keychain -p "$(cat "$PASS_FILE")" "$KC"
  security set-keychain-settings "$KC"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  /usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=$IDENTITY" \
    -addext "keyUsage=critical,digitalSignature" \
    -addext "extendedKeyUsage=critical,codeSigning" \
    -keyout "$tmp/key.pem" -out "$tmp/cert.pem" 2>/dev/null
  /usr/bin/openssl pkcs12 -export -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
    -out "$tmp/id.p12" -passout pass:mini-ui
  security import "$tmp/id.p12" -k "$KC" -P mini-ui -T /usr/bin/codesign >/dev/null
  security set-key-partition-list -S apple-tool:,apple: -s -k "$(cat "$PASS_FILE")" "$KC" >/dev/null
  # shellcheck disable=SC2046
  security list-keychains -d user -s $(security list-keychains -d user | tr -d '"') "$KC"
  echo "created signing identity \"$IDENTITY\""
fi
security unlock-keychain -p "$(cat "$PASS_FILE")" "$KC"

mkdir -p "$APP/Contents/MacOS"
swiftc -O "$here/MiniUI.swift" -o "$APP/Contents/MacOS/MiniUI"
cat >"$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>MiniUI</string>
<key>CFBundleIdentifier</key><string>local.jeroen.mini-ui</string>
<key>CFBundleName</key><string>MiniUI</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
codesign --force --keychain "$KC" -s "$IDENTITY" "$APP"
echo "built $APP"
