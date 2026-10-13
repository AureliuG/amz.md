# Running the dashboard for real

The app is one Node.js server. It keeps its data (imported institutions, fleet cards, warehouse location,
GPS history, driver confirmations) as plain files in a `data/` folder.

| Who | Opens | Needs |
|---|---|---|
| Office (dispatch, warehouse) | `https://<address>/` | Office password |
| Drivers (phones) | `https://<address>/sofer` | Driver password (user `sofer`) |
| GPS provider / connector | `POST https://<address>/api/gps` | `GPS_INGEST_TOKEN` |

Drivers and the GPS provider reach the server **from outside the office**, and phones only share their
location over **HTTPS**. So the recommended setup is **option B** (a small rented server). Option A is
fine to try it inside the office first.

## Settings (environment variables)

| Variable | What it does |
|---|---|
| `APP_PASSWORD` | Office password. The browser asks once (any user name). |
| `DRIVER_PASSWORD` | Driver password, user name `sofer`. Only opens the Șofer page. |
| `GPS_INGEST_TOKEN` | Secret the GPS provider sends as `Authorization: Bearer <token>`. |
| `DATA_DIR` | Data folder (default `./data`). **Back it up daily.** |
| `PORT` | Port (default 3000). |

If no password is set, the app is open to anyone who can reach it. Only do that on a closed office network.

## Option A: an office Windows PC (for trying it out)

1. Install **Node.js 22 LTS** from nodejs.org.
2. Copy the project folder to the PC, e.g. `C:\nobilprest`.
3. Create `C:\nobilprest\.env.local` from `.env.example` and set the passwords.
4. In a terminal in that folder:
   ```
   npm ci
   npm run build
   npm start
   ```
5. Open `http://localhost:3000`, or `http://<PC name>:3000` from other office computers.
6. To start it with Windows, register `npm start` as a service (e.g. with NSSM) or as a Task Scheduler task "At startup".

The PC must stay on during working hours. Phones outside the office can't reach it without extra router setup.

## Option B: a small VPS with Docker (recommended)

**Easiest:** `sudo ./scripts/instalare-server.sh` from the project folder. It installs Docker, asks for the domain,
generates passwords into `.env`, starts `docker-compose.yml` (app + Caddy with automatic HTTPS) and schedules a nightly backup.
The Romanian step-by-step version is in [GHID-INSTALARE.md](GHID-INSTALARE.md). The manual steps are below.

Any 1 vCPU / 1–2 GB RAM Linux server is enough, e.g. at a Moldovan hosting provider.

```bash
docker build -t nobilprest .
docker run -d --name nobilprest --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -v /srv/nobilprest:/data \
  -e APP_PASSWORD='…' -e DRIVER_PASSWORD='…' -e GPS_INGEST_TOKEN='…' \
  nobilprest
```

HTTPS with [Caddy](https://caddyserver.com) (it gets the certificate automatically). Point a domain such as
`livrari.nobilprest.md` at the server, then use this `/etc/caddy/Caddyfile`:

```
livrari.nobilprest.md {
    reverse_proxy 127.0.0.1:3000
}
```

**Backups:** copy `/srv/nobilprest` every night (e.g. `tar` + upload, or the hosting provider's snapshots).

**Updates:** `git pull`, then rebuild the image and run the `docker run` command again.
The data folder is kept.

## Drivers' phones

1. Open `https://<address>/sofer`, then enter user `sofer` and the driver password.
2. Pick the truck number once. It is remembered on that phone.
3. Add it to the home screen: Chrome menu → *Add to Home screen* on Android, or Share → *Add to Home Screen* on iPhone.
4. For trucks whose tracker doesn't work (now 4, 5 and 12), switch on **Trimite poziția din telefon** and keep the
   page open during the trip. iPhones stop sending when the screen is locked; Android keeps going while the page is open.

Taps on *Livrat / Problemă* made without signal are saved on the phone and sent when it is back online.

## What is stored where

| File in `data/` | Content |
|---|---|
| `institutions.json` | Imported institutions (Date page) |
| `fleet.json` | Fleet cards (Date page → Flota) |
| `settings.json` | Warehouse location |
| `gps-latest.json` | Last position of every tracker/phone |
| `gps/<day>.ndjson` | Every position received that day (route history) |
| `events/<day>.ndjson` | Driver confirmations (arrived / delivered / problem) |
