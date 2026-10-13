/**
 * App version, what each version contains and what comes next (shown on the Ghid page).
 * When releasing: bump "version" in package.json, move items from ROADMAP to CHANGELOG, update CHANGELOG.md.
 */
import pkg from "../../package.json";

/** "1.2.0" → shown as "1.2" in the app. */
export const APP_VERSION: string = pkg.version;
export const APP_VERSION_SHORT = APP_VERSION.replace(/\.0$/, "");
export const RELEASE_DATE = "13 octombrie 2026";

export interface Release {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Released versions, newest first. */
export const CHANGELOG: Release[] = [
  {
    version: "1.2",
    date: RELEASE_DATE,
    title: "Lucru în echipă, șoferi și instalare pe server",
    items: [
      "Datele (instituții, flotă, depozit) se salvează pe server și sunt aceleași pe toate calculatoarele",
      "Fișa flotei: nr. înmatriculare, tracker, model, capacitate, frigorific, șofer, telefon, traseu fix/zilnic, activă",
      "Alerte: livrări după 18:00, comenzi care nu încap, produse refrigerate în mașini nefrigorifice, GPS lipsă, stoc insuficient, probleme raportate de șoferi",
      "Foaie de încărcare și foaie de parcurs pentru tipar (A4), pe mașină sau toate odată",
      "Pagina Șofer pe telefon: opriri în ordine, Maps/Waze, apel, „Am ajuns / Livrat / Problemă”, funcționează și fără semnal",
      "Poziția GPS din telefonul șoferului pentru mașinile fără tracker",
      "Export Excel (CSV) al livrărilor, necesarul zilei față de stoc",
      "Parole pentru birou și pentru șoferi, instalare pe server cu un singur script, copii de rezervă",
      "Ghid în aplicație, listă de verificare „Primii pași”, propuneri și probleme",
    ],
  },
  {
    version: "1.1",
    date: "12 octombrie 2026",
    title: "Datele reale ale companiei",
    items: [
      "Interfața în limba română, numele Nobil Prest",
      "Cele 16 mașini reale, cu numerele și trackerele din programul GPS",
      "Paginile Livrări, Program și Date",
      "Import instituții din Excel/CSV (export 1C), locația depozitului",
      "Primirea pozițiilor GPS și modul „Live GPS” pe hartă",
    ],
  },
  {
    version: "1.0",
    date: "4 octombrie 2026",
    title: "Prima demonstrație",
    items: ["Depozitul 3D (rampe, cameră frigorifică, depozit subteran)", "Harta Moldovei cu traseele mașinilor", "Panouri: indicatori, urmărirea livrării, mașini, rampe, stoc"],
  },
];

export interface Planned {
  version: string;
  title: string;
  items: string[];
  /** What the company has to provide for this version to be possible. */
  needs: string[];
}

/** What comes next, in order. */
export const ROADMAP: Planned[] = [
  {
    version: "1.3",
    title: "Date reale la zi",
    items: [
      "Lista reală a celor ~800 de instituții pe hartă, cu adrese verificate",
      "Pozițiile reale ale mașinilor de la furnizorul GPS, traseul parcurs al zilei",
      "Fișele complete ale mașinilor (modele, capacități, șoferi)",
      "Rapoarte simple: livrări pe zi/lună, pe mașină, întârzieri",
    ],
    needs: ["Exportul instituțiilor din 1C (Excel)", "Numele și contactul furnizorului GPS + acces (API sau retransmisie)", "Locația exactă a depozitului"],
  },
  {
    version: "1.4",
    title: "Comenzile din 1C automat",
    items: [
      "Comenzile, facturile și stocul vin automat din 1C 7.7 (la fiecare 5–15 minute)",
      "Nr. facturii pe foaia de parcurs și la fiecare livrare",
      "Stocul real în depozitul 3D și în alerte",
    ],
    needs: ["Programatorul 1C al companiei (pentru un export programat din 1C 7.7)", "Un exemplu de export: o zi de comenzi și stocul"],
  },
  {
    version: "1.5",
    title: "Planificarea traseelor",
    items: [
      "Trasee pe drumuri reale (nu linii drepte), timpi de mers reali",
      "Planificare automată: comenzile se împart pe mașini după capacitate și zonă",
      "Traseele fixe pe zile ale săptămânii + traseele zilnice",
      "Mutarea unei opriri pe altă mașină prin tragere cu mouse-ul",
    ],
    needs: ["Regulile traseelor fixe (ce mașină, ce zi, ce instituții)"],
  },
  {
    version: "2.0",
    title: "Companie complet digitală",
    items: [
      "Conturi personale (dispecer, depozit, contabilitate, șoferi) cu drepturi diferite",
      "Notificări pe Viber/SMS către instituții: „mașina sosește în ~15 min”",
      "Fotografia facturii ștampilate la livrare",
      "Istoric și analize pe luni, consum de combustibil, km",
    ],
    needs: ["Decizia companiei privind notificările către clienți", "Lista utilizatorilor și rolurilor"],
  },
];

/** Shown in the "Ce este nevoie" section of the guide. */
export const REQUIREMENTS: { title: string; items: string[] }[] = [
  {
    title: "Server",
    items: [
      "Un server virtual (VPS) cu Linux Ubuntu 22.04 sau 24.04: 1 procesor, 2 GB RAM, 20 GB disc (aprox. 5–15 € pe lună)",
      "Un domeniu sau subdomeniu, de ex. livrari.nobilprest.md, îndreptat spre IP-ul serverului (necesar pentru HTTPS și GPS-ul din telefoane)",
      "Acces SSH pentru instalare (o singură dată, ~30 de minute)",
    ],
  },
  {
    title: "Calculatoare în oficiu",
    items: ["Google Chrome sau Microsoft Edge actualizat", "Placă video cu accelerare (WebGL) pentru depozitul 3D și hartă; altfel se folosesc paginile Livrări/Program/Date", "Imprimantă A4 pentru foile de încărcare și de parcurs"],
  },
  {
    title: "Telefoanele șoferilor",
    items: ["Android 8+ (Chrome) sau iPhone cu iOS 15+ (Safari)", "Internet mobil (câțiva MB pe zi)", "Pentru mașinile 4, 5, 12 (fără tracker): pagina Șofer deschisă în timpul cursei"],
  },
  {
    title: "Date de la companie",
    items: ["Lista instituțiilor (Excel din 1C): denumire, localitate, adresă, telefon", "Locația depozitului", "Fișa fiecărei mașini: model, capacitate, frigorific, șofer, telefon", "Mai târziu: export din 1C 7.7 și acces la furnizorul GPS"],
  },
];
