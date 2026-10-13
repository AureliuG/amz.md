# Versiuni — Nobil Prest · Depozit & livrări

Versiunea curentă apare în aplicație lângă numele Nobil Prest și pe pagina **Ghid → Versiunea și ce urmează**.
La o versiune nouă: se modifică `version` în `package.json`, se mută punctele din „Urmează” în lista de mai jos
(și în `src/lib/version.ts`), apoi se rulează `sudo ./scripts/actualizare.sh` pe server.

## 1.2 — 13 octombrie 2026 · Lucru în echipă, șoferi și instalare pe server
- Datele (instituții, flotă, depozit) se salvează pe server și sunt aceleași pe toate calculatoarele.
- Fișa flotei: nr. înmatriculare, tracker, model, capacitate, frigorific, șofer, telefon, traseu fix/zilnic, activă.
- Alerte:
  - livrări după 18:00;
  - comenzi care nu încap;
  - produse refrigerate în mașini nefrigorifice;
  - GPS lipsă;
  - stoc insuficient;
  - probleme raportate de șoferi.
- Foaie de încărcare și foaie de parcurs pentru tipar (A4), pe mașină sau toate odată.
- Pagina **Șofer** pe telefon: opriri în ordine, Maps/Waze, apel, „Am ajuns / Livrat / Problemă”. Merge și fără semnal.
- Poziția GPS din telefonul șoferului pentru mașinile fără tracker.
- Export Excel (CSV) al livrărilor; necesarul zilei față de stoc.
- Parole pentru oficiu și pentru șoferi.
- Instalare pe server cu un singur script, HTTPS automat, copii de rezervă zilnice.
- Ghid în aplicație:
  - fereastra „Bun venit” / „Ce e nou”;
  - lista „Primii pași”;
  - „Ce este nevoie”;
  - propuneri și probleme (din oficiu și de la șoferi);
  - cod QR pentru șoferi.

## 1.1 — 12 octombrie 2026 · Datele reale ale companiei
- Interfața în limba română, numele Nobil Prest.
- Cele 16 mașini reale, cu numerele și trackerele din programul GPS.
- Paginile Livrări, Program și Date.
- Import instituții din Excel/CSV (export 1C), locația depozitului.
- Primirea pozițiilor GPS și modul „Live GPS” pe hartă.

## 1.0 — 4 octombrie 2026 · Prima demonstrație
- Depozitul 3D (rampe, cameră frigorifică, depozit subteran).
- Harta Moldovei cu traseele mașinilor.
- Panouri: indicatori, urmărirea livrării, mașini, rampe, stoc.

---

## Urmează

### 1.3 · Date reale la zi
- Lista reală a celor ~800 de instituții, cu adrese verificate.
- Pozițiile reale de la furnizorul GPS, traseul parcurs al zilei.
- Fișele complete ale mașinilor. Rapoarte simple (livrări pe zi/lună, pe mașină, întârzieri).
- *De la companie:* Excel instituții din 1C; contactul și accesul furnizorului GPS; locația depozitului.

### 1.4 · Comenzile din 1C automat
- Comenzi, facturi și stoc din 1C 7.7 la 5–15 minute. Nr. facturii pe foaia de parcurs. Stocul real.
- *De la companie:* programatorul 1C; un export de exemplu (o zi de comenzi + stoc).

### 1.5 · Planificarea traseelor
- Drumuri reale, împărțire automată pe mașini, trasee fixe pe zile, mutarea opririlor cu mouse-ul.
- *De la companie:* regulile traseelor fixe.

### 2.0 · Companie complet digitală
- Conturi personale cu drepturi, notificări Viber/SMS către instituții, foto factură, analize lunare.
- *De la companie:* decizia privind notificările; lista utilizatorilor și rolurilor.
