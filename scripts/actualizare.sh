#!/usr/bin/env bash
# Actualizare la o versiune nouă: descarcă codul nou și repornește. Datele și parolele rămân.
#   sudo ./scripts/actualizare.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

before=$(grep -m1 '"version"' package.json | cut -d'"' -f4)
echo "Versiunea actuală: $before"
./scripts/backup.sh
if [ -d .git ]; then
  git pull --ff-only
else
  echo "Folderul nu este un depozit git: copiați manual fișierele noi, apoi rulați din nou." >&2
fi
after=$(grep -m1 '"version"' package.json | cut -d'"' -f4)
$SUDO docker compose up -d --build
$SUDO docker image prune -f >/dev/null 2>&1 || true
echo "Gata: $before → $after. Utilizatorii văd „Ce e nou” la următoarea deschidere."
