# Versiuni — Nobil Prest · Depozit & livrări

Versiunea curentă apare în aplicație lângă numele Nobil Prest și pe pagina **Ghid → Versiunea și ce urmează**.
La o versiune nouă: se modifică `version` în `package.json`, se mută punctele din „Urmează” în lista de mai jos
(și în `src/lib/version.ts`), apoi se rulează `sudo ./scripts/actualizare.sh` pe server.

## 1.3 — 13 octombrie 2026 · Ciclul complet: comenzi, trasee, încărcare, stoc
- **Comenzi**: toate comenzile într-un singur loc. „Comandă nouă” pentru fiecare telefon (instituția, ziua livrării — implicit mâine —, produsele), „Ca ultima comandă”, mutare pe altă zi, anulare, nr. factură.
- **Ciclul zilei** pe un singur ecran: comenzi primite → trasee → încărcare → livrare → facturi.
- **Traseele se fac din comenzile reale**:
  - mașinile cu traseu fix își iau localitățile (Date → Flota);
  - Chișinăul merge cu mașinile mici;
  - restul țării se împarte pe direcții, astfel încât fiecare mașină să termine până la 18:00.
- **Trasee**: pe zile (azi, mâine…), „Aprobă traseele”, comenzile fără mașină, mutarea unei comenzi pe altă mașină, foile pentru orice zi.
- **Încărcarea ca în realitate**: o singură rampă la depozit și beciul alături. O mașină la beci, una la rampă; pleacă primele cele cu drumul lung.
- **„Încărcată”** scade produsele mașinii din stoc (se poate anula).
- **Stoc**: stocul real, ce se încarcă azi și mâine, ce rămâne, ce trebuie comandat. Intrare marfă, inventariere, lista de produse, istoricul mișcărilor.
- **Depozitul 3D**: beciul lângă depozit și o singură rampă.
- **Comenzi de test** generate și șterse dintr-un clic, ca să încercați tot ciclul.
- Ceasul din bara de sus nu mai mișcă glisorul.
- Merge și pe găzduirea web (PHP de la 5.4 în sus), cu pagina de verificare `verificare.php`.

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
- Sau pe găzduirea web existentă (cPanel, PHP), într-un folder (de ex. draur.com/delivery), cu cod de acces: se încarcă o arhivă și se dezarhivează.
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

### 1.4 · Date reale și 1C
- Lista reală a celor ~800 de instituții, cu adrese verificate.
- Comenzile, facturile și stocul vin automat din 1C 7.7 (fără a le introduce de două ori).
- Pozițiile reale de la furnizorul GPS. Rapoarte simple (livrări pe zi/lună, pe mașină, întârzieri).
- *De la companie:* Excel instituții din 1C; programatorul 1C și un export de exemplu; accesul furnizorului GPS; locația depozitului.

### 1.5 · Comenzi online de la instituții
- Fiecare instituție primește linkul ei și trimite comanda direct, până la o oră stabilită. Apare pe pagina Comenzi.
- *De la companie:* care instituții încep primele; ora-limită pentru comenzi.

### 1.6 · Planificare avansată
- Drumuri reale, traseele fixe pe zile, mutarea opririlor cu mouse-ul, încărcarea de seara, setări pentru încărcare.
- *De la companie:* regulile traseelor fixe; de la ce oră și cât durează încărcarea unei mașini.

### 2.0 · Companie complet digitală
- Conturi personale cu drepturi, notificări Viber/SMS către instituții, foto factură, analize lunare.
- *De la companie:* decizia privind notificările; lista utilizatorilor și rolurilor.
