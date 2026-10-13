#!/usr/bin/env bash
# Builds the package for ordinary web hosting with cPanel (PHP, no Node.js needed):
# the app as static files + a small PHP API + an access-code page, in one ZIP to upload and extract.
#
#   COD=1234AB ./scripts/pachet-gazduire.sh [folder]      (folder default: delivery → https://domeniu/delivery/)
#
# Output in dist/:
#   nobilprest-<folder>-v<version>.zip              first install (contains config.php with the access code)
#   nobilprest-<folder>-v<version>-actualizare.zip  updates (without config.php, so the code and keys stay)
# The settings are kept in dist/<folder>-config.php and reused by the next build.
set -euo pipefail
cd "$(dirname "$0")/.."

FOLDER="${1:-delivery}"
[[ "$FOLDER" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Nume de folder invalid: $FOLDER"; exit 1; }
VERSION=$(node -p "require('./package.json').version")
DIST=dist
BUILD=.build-gazduire
CONFIG="$DIST/$FOLDER-config.php"
mkdir -p "$DIST"

if [[ ! -f "$CONFIG" ]]; then
  COD="${COD:-}"
  [[ -n "$COD" ]] || read -rp "Codul de acces pentru birou: " COD
  [[ "$COD" =~ ^[A-Za-z0-9]{4,32}$ ]] || { echo "Codul trebuie să aibă 4–32 litere/cifre."; exit 1; }
  rnd() { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"; }
  cat > "$CONFIG" <<CFG
<?php
// Setările Nobil Prest pe găzduirea web. Se modifică din cPanel → File Manager → config.php → Edit.
return [
    // Codul de acces pentru birou (vede tot). Gol = aplicația e deschisă oricui are adresa.
    'cod_birou' => '$COD',
    // Cod separat pentru șoferi (văd doar pagina Șofer). Gol = șoferii intră cu codul biroului.
    'cod_sofer' => '',
    // Cheia pentru furnizorul GPS: trimite pozițiile la /$FOLDER/api/gps cu antetul "Authorization: Bearer <cheie>".
    'cheie_gps' => '$(rnd 16)',
    // Valoare secretă aleatorie. Schimbați-o ca să fie deconectată toată lumea.
    'sare' => '$(rnd 24)',
    // Folderul cu date. Gol = automat, în afara site-ului (ex. /home/<cont>/nobilprest-date-$FOLDER).
    'date' => '',
];
CFG
  echo "Setările sunt în $CONFIG (se refolosesc la următoarele pachete)."
fi

echo "1/3 Construiesc aplicația pentru /$FOLDER/ ..."
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp -r src public package.json next.config.mjs tsconfig.json postcss.config.mjs "$BUILD/"
# No Node server on the hosting: the API is api.php, access is checked by gate.php.
rm -rf "$BUILD/src/app/api" "$BUILD/src/middleware.ts"
NP_EXPORT=1 NEXT_PUBLIC_BASE_PATH="/$FOLDER" NEXT_PUBLIC_ACCESS=cod NEXT_TELEMETRY_DISABLED=1 npx next build "$BUILD" >"$DIST/build-gazduire.log" 2>&1 \
  || { tail -30 "$DIST/build-gazduire.log"; exit 1; }

echo "2/3 Adaug partea PHP ..."
OUT="$DIST/$FOLDER"
rm -rf "$OUT"
mkdir -p "$OUT"
cp -r "$BUILD/out/." "$OUT/"
cp deploy/gazduire/.htaccess deploy/gazduire/gate.php deploy/gazduire/api.php "$OUT/"
sed "s/__VERSION__/$VERSION/" deploy/gazduire/np.php >"$OUT/np.php"
# Default tracker per truck number, for phone positions before the fleet cards are saved.
npx tsx -e '
import { DEFAULT_FLEET } from "./src/lib/seed";
const rows = DEFAULT_FLEET.map((f) => `  ${f.number} => ${JSON.stringify(f.trackerId)},`).join("\n");
process.stdout.write(`<?php\n// Trackerele implicite ale mașinilor (din src/lib/seed.ts).\nreturn [\n${rows}\n];\n`);
' >"$OUT/np-flota.php"
rm -rf "$BUILD"

echo "3/3 Fac arhivele ZIP ..."
ZIP="nobilprest-$FOLDER-v$VERSION"
rm -f "$DIST/$ZIP.zip" "$DIST/$ZIP-actualizare.zip"
(cd "$DIST" && zip -qr "$ZIP-actualizare.zip" "$FOLDER")
cp "$CONFIG" "$OUT/config.php"
(cd "$DIST" && zip -qr "$ZIP.zip" "$FOLDER")
ls -lh "$DIST/$ZIP.zip" "$DIST/$ZIP-actualizare.zip"
echo "Gata. Încărcați $ZIP.zip în folderul domeniului (cPanel → File Manager → Upload), apoi Extract."
