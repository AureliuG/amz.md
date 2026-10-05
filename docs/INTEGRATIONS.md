# Integrations: 1C 7 and GPS

Both systems stay as they are. Nobil Prest keeps working in 1C and the GPS client.
The dashboard **reads** from them and never writes back.

```
 1C 7 (office PC)  ──export every N min──►  ┐
                                            ├─► Connector (small Windows service) ──HTTPS──► Dashboard API ──► DB ──► screens
 GPS trackers ──► GPS provider server ──────┘        or direct feed from GPS provider ─────────────┘
```

## 1. Fleet (done in the app)

The 16 vehicles from the GPS client are loaded as `REAL_FLEET` in `src/lib/seed.ts`.
The row number in the GPS client is the truck number in the app (Mașina 1–16).

| # | Plate | Tracker | GPS |
|---|---|---|---|
| 1 | XLX 827 | 059166 | ✔ |
| 2 | XLX 119 | 065129 | ✔ |
| 3 | XLX 092 | 059072 | ✔ |
| 4 | WSS 904 | 059024 | ✖ never reported (01.01 00:00:00) |
| 5 | WSS 794 | 059085 | ✖ never reported |
| 6 | SZS 070 | 065080 | ✔ |
| 7 | ROV 016 | 059084 | ✔ |
| 8 | MSM 906 | 068235 | ✔ |
| 9 | MSM 860 | 062138 | ✔ |
| 10 | KZC 153 | 009254 | ✔ (battery icon shown in the client) |
| 11 | KOL 959 | 059083 | ✔ |
| 12 | HNAX 023 | 065133 | ✖ never reported |
| 13 | DAD 1 | 068226 | ✔ |
| 14 | BTM 486 | 068234 | ✔ |
| 15 | BKB 717 | 068232 | ✔ |
| 16 | BKB 702 | 068233 | ✔ |

To confirm: are all 16 delivery vehicles (some may be cars or trailers)? Should 4, 5 and 12 have working
trackers? Models, capacities, refrigeration and usual drivers are still to fill in.

## 2. GPS

The office uses a desktop **"GPS Client v1.4.2203.17"** (connect / archive / map). It is a client for the
GPS provider's server, so positions already reach a server we can read from. Options, best first:

1. **Provider API**: many providers offer an HTTP/JSON API (latest position per tracker, history).
   We poll it every 10–30 s. Needs: provider name, API documentation, a login or API key.
2. **Retransmission**: the provider (or the trackers themselves) forwards a copy of every position to our
   server, usually as Wialon IPS, EGTS or the tracker's native protocol (e.g. Teltonika). We run a small receiver.
   Needs: provider support, or the tracker model and access to its configuration.
3. **Fallback**: export from the GPS client (archive/save) on a schedule. Not live, but useful for history.

Mapping is by tracker ID (6 digits) → truck. Once live, the simulated truck movement is replaced by
real positions. Arrival at an institution is detected when the truck stays within about 150 m for 3 or more minutes.

**What we need:** the GPS provider's name and contact, the tracker model, and whether they offer an API or
retransmission.

## 3. 1C 7 (1C:Enterprise 7.7)

1C 7.7 is old and has no web API, but there are three proven ways to get data out:

| Option | How | Pros / cons |
|---|---|---|
| **A. Scheduled export (recommended)** | A small 1C processing (`.ert`) that a 1C programmer adds, run on a schedule, writes orders, institutions and stock to CSV/XML in a shared folder. The connector uploads new files. | Safe, read-only, no changes to the 1C database. Data is as fresh as the export interval (e.g. 5–15 min). |
| B. OLE automation | The connector opens 1C through COM (`V77.Application`) on the office PC and reads documents directly. | No 1C changes, but needs a Windows machine with 1C and a 1C user licence free. Fragile. |
| C. Read the database | If 1C runs on **MS SQL**, read its tables (read-only user). If it is the **file (DBF)** version, read the DBF files. | Fast, but 1C 7.7 table and column names are coded (SC123, DH45…), so a 1C specialist must map them. |

### What we import

- **Institutions (contragenți)**: code, name, address, phone, contact. Coordinates are geocoded once,
  then confirmed on the map.
- **Orders**: number, date, institution, delivery date, lines (product, quantity, unit).
- **Invoices (facturi)**: number and date, linked to the order, shown on the delivery.
- **Products and stock**: code, name, unit, stock, warehouse (main / underground depot).

**What we need:** is 1C 7.7 the file (DBF) or SQL version? Who maintains it (in-house or an outside 1C
programmer)? Sample exports of 1 day of orders and the institution list (Excel is fine to start).

## 4. Order of work

1. Institutions list from 1C (Excel/CSV) → real points on the map.
2. GPS feed → real truck positions (replaces the simulation for the 13 working trackers).
3. Orders and invoices from 1C → real deliveries in Livrări, Program and the map.
4. Stock from 1C → the warehouse view and the Stoc tab.
