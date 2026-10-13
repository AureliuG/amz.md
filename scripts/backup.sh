#!/usr/bin/env bash
# Copie de rezervă a datelor (instituții, flotă, GPS, confirmări, propuneri) în backups/.
# Păstrează ultimele 30 de copii. Restaurare: opriți (docker compose down), dezarhivați peste data/, porniți.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
[ -d data ] || { echo "Nu există folderul data/ încă."; exit 0; }
file="backups/nobilprest-$(date +%Y-%m-%d_%H%M).tar.gz"
tar -czf "$file" data .env 2>/dev/null || tar -czf "$file" data
chmod 600 "$file"
ls -1t backups/nobilprest-*.tar.gz | tail -n +31 | xargs -r rm -f
echo "Copie salvată: $file"
