#!/usr/bin/env bash
# Instalare Nobil Prest · Depozit & livrări pe un server Ubuntu 22.04 / 24.04.
# Rulați din folderul aplicației:   sudo ./scripts/instalare-server.sh
# Se poate rula din nou fără grijă: păstrează setările (.env) și datele (data/).
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

say "Nobil Prest · instalare (versiunea $(grep -m1 '"version"' package.json | cut -d'"' -f4))"

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  say "Instalez Docker (o singură dată)…"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
if ! $SUDO docker compose version >/dev/null 2>&1; then
  echo "Lipsește „docker compose”. Instalați pachetul docker-compose-plugin și rulați din nou." >&2
  exit 1
fi

# 2. Setări și parole (.env) — create o singură dată
if [ ! -f .env ]; then
  say "Setări"
  echo "Introduceți domeniul aplicației (ex. livrari.nobilprest.md), îndreptat deja spre IP-ul acestui server."
  echo "Apăsați Enter fără nimic pentru o instalare de test pe IP (fără HTTPS, fără GPS din telefoane)."
  read -rp "Domeniu: " DOMAIN_IN || true
  gen() { LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom 2>/dev/null | head -c "${1:-14}" || true; }
  umask 077
  cat > .env <<ENV
DOMAIN=${DOMAIN_IN:-:80}
APP_PASSWORD=$(gen 14)
DRIVER_PASSWORD=$(gen 10)
GPS_INGEST_TOKEN=$(gen 32)
ENV
  umask 022
  say "Am creat .env cu parole noi (le vedeți la final)."
else
  say "Folosesc setările existente din .env"
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# 3. Firewall (dacă ufw este activ)
if command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
  $SUDO ufw allow 80/tcp >/dev/null
  $SUDO ufw allow 443/tcp >/dev/null
fi

# 4. Pornire
mkdir -p data backups
say "Construiesc și pornesc aplicația (prima dată durează 3–6 minute)…"
$SUDO docker compose up -d --build

say "Aștept să pornească…"
ok=""
for _ in $(seq 1 60); do
  if $SUDO docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ -z "$ok" ] && warn "Aplicația nu răspunde încă. Verificați: sudo docker compose logs app"

# 5. Copie de rezervă zilnică la 02:15
chmod +x scripts/*.sh
if command -v crontab >/dev/null 2>&1; then
  CRON_LINE="15 2 * * * cd $(pwd) && ./scripts/backup.sh >/dev/null 2>&1"
  ( $SUDO crontab -l 2>/dev/null | grep -v 'scripts/backup.sh' || true; echo "$CRON_LINE" ) | $SUDO crontab -
else
  warn "Nu există crontab: copiile zilnice nu sunt programate. Rulați ./scripts/backup.sh manual sau instalați cron."
fi

# 6. Rezumat
if [ "${DOMAIN:-:80}" = ":80" ]; then
  URL="http://$(hostname -I 2>/dev/null | awk '{print $1}')"
  warn "Instalare de test fără domeniu: fără HTTPS, telefoanele nu pot trimite GPS. Pentru producție puneți DOMAIN în .env și rulați din nou."
else
  URL="https://${DOMAIN}"
fi
cat <<INFO

────────────────────────────────────────────────────────────
  Nobil Prest este pornit.

  Oficiu:       $URL
                utilizator: oricare   parola: ${APP_PASSWORD}

  Șoferi:       $URL/sofer
                utilizator: sofer     parola: ${DRIVER_PASSWORD}

  Furnizor GPS: POST $URL/api/gps
                Authorization: Bearer ${GPS_INGEST_TOKEN}

  Datele:       $(pwd)/data      (copie zilnică în $(pwd)/backups)
  Actualizare:  sudo ./scripts/actualizare.sh

  Păstrați aceste parole într-un loc sigur (sunt și în fișierul .env).
────────────────────────────────────────────────────────────
INFO
