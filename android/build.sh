#!/usr/bin/env bash
# Builds dist/Spire.apk: the web game wrapped in a fullscreen Android WebView.
# No Gradle and no Android Studio. On Ubuntu or Debian the tools come from:
#   sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
# Usage:  android/build.sh [versionCode] [versionName]      e.g.  android/build.sh 2 1.1
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
VCODE="${1:-1}"
VNAME="${2:-1.0}"
KS="$HERE/spire-sideload.keystore"
OUT="$ROOT/dist/Spire.apk"
B="$(mktemp -d)"
trap 'rm -rf "$B"' EXIT

# 1. the game itself goes in as assets
mkdir -p "$B/assets" "$B/gen" "$B/obj" "$ROOT/dist"
cp "$ROOT/index.html" "$ROOT/icon.svg" "$ROOT/manifest.webmanifest" "$B/assets/"
cp -r "$ROOT/css" "$ROOT/js" "$B/assets/"

# 2. resources -> R.java, then compile and convert to Dalvik bytecode
aapt package -f -m -J "$B/gen" -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -I "$JAR"
javac -nowarn -source 8 -target 8 -bootclasspath "$JAR" -d "$B/obj" \
  "$HERE/src/com/z0rug1/spire/MainActivity.java" "$B/gen/com/z0rug1/spire/R.java" 2>&1 | grep -v "^warning\|^Note\|bootstrap class path\|^1 warning\|^Picked up" || true
dalvik-exchange --dex --output="$B/classes.dex" "$B/obj"

# 3. package, align, sign
aapt package -f -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -A "$B/assets" -I "$JAR" \
  --min-sdk-version 21 --target-sdk-version 34 --version-code "$VCODE" --version-name "$VNAME" -F "$B/unaligned.apk"
(cd "$B" && aapt add unaligned.apk classes.dex >/dev/null)
zipalign -f 4 "$B/unaligned.apk" "$B/aligned.apk"

# The signing key lives in this folder so that every build can update an installed copy.
# It is a sideloading key, not a secret: do not reuse it for anything published to a store.
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias spire \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Spire sideload, O=z0rug1" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias spire \
  --min-sdk-version 21 --out "$OUT" "$B/aligned.apk"
rm -f "$OUT.idsig"
apksigner verify --min-sdk-version 21 "$OUT"
echo "Built $OUT ($(du -h "$OUT" | cut -f1)), version $VNAME ($VCODE)"
