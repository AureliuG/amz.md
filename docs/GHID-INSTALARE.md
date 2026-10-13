# Nobil Prest · Depozit & livrări — Ghid de instalare și pornire

**Versiunea 1.2** · 13 octombrie 2026

Acest ghid este pentru persoana care pune aplicația pe server (administrator, IT) și pentru conducerea
companiei, care vrea să verifice ce face aplicația și ce mai trebuie pentru a o folosi zilnic.
Ghidul de utilizare (pentru dispeceri și șoferi) este **în aplicație**, pe pagina **Ghid**.

---

## 1. Ce primiți în versiunea 1.2

| Pentru cine | Ce face |
|---|---|
| **Oficiu / dispecerat** | Depozitul 3D, harta Moldovei cu mașinile, lista livrărilor zilei, programul pe ore, alerte, foi de încărcare și de parcurs pentru tipar, export Excel. |
| **Depozit** | Foaia de încărcare pe zone (subteran, frigorific, uscate) și ordinea de încărcare. Alerte de stoc insuficient. |
| **Șoferi** | Pagina **Șofer** pe telefon: opririle în ordine, navigare Maps/Waze, apel, „Am ajuns / Livrat / Problemă”, GPS din telefon pentru mașinile fără tracker. |
| **Conducere** | Pagina **Ghid** → „Primii pași”: ce este gata și ce mai lipsește. „Propuneri și probleme”: ce cer colegii. „Versiunea și ce urmează”. |

**Important:** comenzile, traseele și stocul sunt deocamdată **exemple**, până la conectarea 1C (versiunea 1.4).
Reale sunt deja:
- cele 16 mașini (numere și trackere din programul GPS);
- instituțiile importate din Excel;
- locația depozitului;
- pozițiile GPS;
- confirmările șoferilor;
- propunerile colegilor.

---

## 2. Ce este nevoie

### Server (recomandat)
- **Un server virtual (VPS)** cu **Ubuntu 22.04 sau 24.04**: 1 procesor, **2 GB RAM**, 20 GB disc.
  Costă aproximativ **5–15 € pe lună** (orice furnizor de hosting din Moldova sau din UE).
- **Un domeniu sau subdomeniu**, de exemplu `livrari.nobilprest.md`, cu o înregistrare DNS de tip **A** spre IP-ul serverului.
  Fără domeniu aplicația merge doar pentru test (fără HTTPS, fără GPS din telefoane).
- **Acces SSH** la server pentru instalare (o singură dată, ~30 de minute).

### Calculatoarele din oficiu
- **Google Chrome** sau **Microsoft Edge** actualizat.
- Placă video cu accelerare (WebGL) pentru depozitul 3D și hartă. Dacă lipsește, aplicația spune asta și restul paginilor merg normal.
- Imprimantă A4 pentru foi.

### Telefoanele șoferilor
- **Android 8+** (Chrome) sau **iPhone cu iOS 15+** (Safari), cu internet mobil (câțiva MB pe zi).

### Date de la companie
| Ce | Pentru ce | Când |
|---|---|---|
| Lista instituțiilor (Excel din 1C): denumire, localitate, adresă, telefon | Punctele reale pe hartă | acum |
| Locația depozitului (coordonate) | De unde pleacă traseele | acum |
| Fișa fiecărei mașini: model, capacitate, frigorific, șofer, telefon | Planificare, alerte, foi | acum |
| Contactul furnizorului GPS + acces (API sau retransmisie) | Poziții reale pe hartă | versiunea 1.3 |
| Programatorul 1C și un export de comenzi + stoc | Comenzile reale automat | versiunea 1.4 |
| Regulile traseelor fixe (mașină, zi, instituții) | Planificare automată | versiunea 1.5 |

---

## 3. Instalare pe server (pas cu pas)

> Comenzile se scriu în terminalul serverului (conectat prin SSH). Fiecare linie se copiază și se apasă Enter.

**Pasul 1.** Conectați-vă la server:
```bash
ssh root@IP-UL-SERVERULUI
```

**Pasul 2.** Descărcați aplicația:
```bash
apt-get update && apt-get install -y git
git clone https://github.com/AureliuG/amz.md.git nobilprest
cd nobilprest
```
*Depozitul este privat: GitHub va cere un utilizator și un token de acces. Alternativ, descărcați arhiva ZIP de pe GitHub
pe calculator și copiați-o pe server (de ex. cu WinSCP), apoi dezarhivați-o în folderul `nobilprest`.*
*Notă: până la unirea în ramura principală, codul versiunii 1.2 se află în ramura
`claude/moldova-delivery-map-visual-z1oih7`. Rulați `git checkout claude/moldova-delivery-map-visual-z1oih7` după `cd nobilprest`.*

**Pasul 3.** Porniți instalarea:
```bash
sudo ./scripts/instalare-server.sh
```
Scriptul:
1. instalează Docker (dacă lipsește);
2. vă întreabă domeniul (ex. `livrari.nobilprest.md`). Apăsați Enter fără nimic pentru o instalare de test pe IP;
3. **generează parolele** pentru oficiu, șoferi și furnizorul GPS și le salvează în fișierul `.env`;
4. construiește și pornește aplicația. **HTTPS se face automat** dacă ați dat un domeniu;
5. programează o **copie de rezervă zilnică** a datelor la ora 02:15;
6. la final afișează adresele și parolele. **Notați-le!**

Exemplu de rezumat afișat:
```
  Oficiu:       https://livrari.nobilprest.md
                utilizator: oricare   parola: ••••••••••••••
  Șoferi:       https://livrari.nobilprest.md/sofer
                utilizator: sofer     parola: ••••••••••
  Furnizor GPS: POST https://livrari.nobilprest.md/api/gps
                Authorization: Bearer ••••••••••••••••••••••••••••••••
```

**Pasul 4.** Deschideți adresa în Chrome pe un calculator din oficiu, introduceți parola de oficiu.
Apare fereastra **„Bun venit”** → **„Deschide primii pași”**.

### Variantă: test rapid pe un calculator Windows din oficiu
Pentru a vedea aplicația înainte de server:
1. Instalați **Node.js 22 LTS** de pe nodejs.org.
2. Copiați folderul aplicației pe calculator.
3. Dublu-click pe `scripts\pornire-windows.bat`.
4. Deschideți `http://localhost:3000`.

Este doar pentru test: telefoanele și furnizorul GPS nu pot ajunge la acest calculator.

---

## 4. Prima configurare (15 minute, în aplicație)

Deschideți **Ghid → Primii pași**. Lista se verifică automat și arată ce mai lipsește:

1. **Locația depozitului.** Date → introduceți coordonatele: în Google Maps țineți apăsat pe depozit și copiați cele două numere.
2. **Flota.** Date → Flota: completați modelul, capacitatea (kg), frigorific, șoferul și telefonul pentru fiecare mașină → **Salvează flota**.
3. **Instituțiile.** Date → Instituții: trageți fișierul Excel exportat din 1C. Verificați coloanele recunoscute → **Aplică**.
   Pentru adresele fără coordonate apăsați **Caută adresele** (durează ~15 minute pentru 800 de adrese).
4. **Șoferii.** Ghid → Pentru șoferi: scanați codul QR cu telefonul fiecărui șofer, introduceți parola de șofer și alegeți mașina.
5. **Primul test.** Un șofer apasă „Livrat” la o oprire. În ~15 secunde apare în **Livrări** cu „✔ confirmat”.

---

## 5. Cum verifică compania aplicația (o zi de test)

| # | Ce faceți | Ce trebuie să vedeți |
|---|---|---|
| 1 | Deschideți aplicația dimineața | Fereastra „Bun venit”, apoi depozitul 3D cu mașinile la rampe |
| 2 | Apăsați **⚠** (sus, dreapta) | Lista alertelor zilei, cu explicații |
| 3 | Program → **Toate foile de încărcare** → tipăriți | O foaie A4 pe mașină, produsele pe zone |
| 4 | Apăsați pe o mașină → **Foaie de parcurs** | Opririle în ordine, rubrici pentru km, combustibil, factură |
| 5 | Pe telefonul unui șofer: pagina Șofer → **Livrat** | În Livrări apare „✔ confirmat” și ora |
| 6 | Pe telefon: **Problemă → Închis** | Alertă roșie „problemă la livrare” |
| 7 | Livrări → **Excel (CSV)** | Fișierul se deschide în Excel cu diacritice corecte |
| 8 | Moldova → Date → **Live GPS** | Mașinile care trimit poziții apar unde sunt (după conectarea GPS) |
| 9 | Ghid → **Propuneri și probleme** → scrieți ceva | Apare în listă, vizibil pentru tot oficiul |

Ce nu vă place sau ce lipsește: scrieți la **Ghid → Propuneri și probleme** (vezi secțiunea 8).

---

## 6. Actualizare la o versiune nouă

```bash
cd nobilprest
sudo ./scripts/actualizare.sh
```
Scriptul face mai întâi o copie de rezervă, descarcă versiunea nouă și repornește. Datele și parolele rămân.
La următoarea deschidere, fiecare utilizator vede fereastra **„Ce e nou în versiunea …”**.
Versiunea curentă apare în aplicație lângă numele Nobil Prest (ex. **v1.2**).

---

## 7. Copii de rezervă și restaurare

- Automat în fiecare noapte (02:15), în `nobilprest/backups/`. Se păstrează ultimele 30.
- Manual, oricând: `./scripts/backup.sh`.
- **Recomandat:** copiați periodic folderul `backups/` și în afara serverului (calculator din oficiu, disc extern sau cloud).
- **Restaurare:**
  ```bash
  cd nobilprest
  sudo docker compose down
  tar -xzf backups/nobilprest-AAAA-LL-ZZ_HHMM.tar.gz
  sudo docker compose up -d
  ```

Ce conține folderul `data/`:

| Fișier | Conținut |
|---|---|
| `institutions.json` | Instituțiile importate |
| `fleet.json` | Fișele mașinilor |
| `settings.json` | Locația depozitului |
| `gps-latest.json`, `gps/<zi>.ndjson` | Ultima poziție a fiecărei mașini și traseul fiecărei zile |
| `events/<zi>.ndjson` | Confirmările șoferilor |
| `feedback.json` | Propunerile și problemele |

---

## 8. Propuneri: cum se adaugă ceva nou

1. **Oricine** din oficiu scrie în aplicație: **Ghid → Propuneri și probleme**. Șoferii scriu de pe pagina Șofer, jos: „Ceva nu merge sau aveți o idee?”.
2. O propunere bună spune:
   - pe ce pagină;
   - ce ați vrut să faceți;
   - ce s-a întâmplat;
   - un exemplu (mașina, instituția, ora).
3. **Responsabilul** (de ex. dispecerul-șef) marchează fiecare propunere:
   - **În lucru**;
   - **Planificat**, cu nota „în versiunea 1.3”;
   - **Rezolvat**;
   - **Nu se face**.
4. Butonul **Excel** descarcă lista, ca să fie trimisă celui care dezvoltă aplicația.
5. La versiunea următoare, ce s-a făcut apare la **Ghid → Versiunea și ce urmează** și în fereastra **„Ce e nou”**.

---

## 9. Ce urmează

| Versiune | Ce aduce | Ce trebuie de la voi |
|---|---|---|
| **1.3** — Date reale la zi | Instituțiile reale pe hartă, GPS-ul de la furnizor, fișele mașinilor, rapoarte simple | Excel instituții, contact furnizor GPS, locația depozitului |
| **1.4** — Comenzile din 1C | Comenzi, facturi și stoc automat din 1C 7.7 la 5–15 minute | Programatorul 1C, un export de exemplu |
| **1.5** — Planificarea traseelor | Drumuri reale, împărțire automată pe mașini, trasee fixe pe zile, mutare cu mouse-ul | Regulile traseelor fixe |
| **2.0** — Companie digitală | Conturi personale, notificări Viber/SMS, foto factură, analize lunare | Decizii privind notificările și rolurile |

Lista completă și actualizată: în aplicație, **Ghid → Versiunea și ce urmează**, și în `CHANGELOG.md`.

---

## 10. Probleme frecvente

| Problemă | Ce faceți |
|---|---|
| Pagina nu se deschide | `cd nobilprest && sudo docker compose ps`: ambele servicii trebuie să fie „Up”. Dacă nu: `sudo docker compose up -d`. |
| „Autentificare necesară” la fiecare deschidere | Normal la prima deschidere. Bifați „Salvează parola” în browser. |
| Am uitat parola | Pe server: `cat nobilprest/.env`. Pentru o parolă nouă, modificați-o acolo, apoi `sudo docker compose up -d`. |
| HTTPS nu merge | Domeniul trebuie să arate spre IP-ul serverului (DNS de tip A), iar porturile 80 și 443 trebuie să fie deschise. Verificați `sudo docker compose logs caddy`. |
| Telefonul nu trimite GPS | Trebuie adresa cu `https://`, iar localizarea permisă pentru browser. Pe iPhone, ecranul să rămână deschis. |
| Depozitul 3D merge greu | Date → Afișare → „Grafică simplificată”. |
| Jurnalul aplicației | `sudo docker compose logs --tail 100 app` |

---

## 11. Pentru partea tehnică (pe scurt)

- O singură aplicație Node.js (Next.js 15), în Docker. **Caddy** face HTTPS automat. Datele sunt fișiere în `data/`, fără bază de date separată.
- Setări în `.env`:
  - `DOMAIN`;
  - `APP_PASSWORD` (oficiu);
  - `DRIVER_PASSWORD` (utilizator `sofer`);
  - `GPS_INGEST_TOKEN`.
- Verificare: `GET /api/health` → `{"ok":true,"version":"1.2.0"}`.
- Integrări GPS și 1C: `docs/INTEGRATIONS.md`. Detalii de instalare în engleză: `docs/DEPLOY.md`.
