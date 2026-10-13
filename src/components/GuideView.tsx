"use client";

import {
  AlertTriangle,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Circle,
  CircleAlert,
  ClipboardList,
  Database,
  Download,
  ListChecks,
  Map as MapIcon,
  MessageSquarePlus,
  Rocket,
  Send,
  Server,
  Smartphone,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DATA_SOURCE } from "@/lib/seed";
import { useUi, type View } from "@/lib/store";
import type { Feedback } from "@/lib/types";
import { APP_VERSION_SHORT, CHANGELOG, RELEASE_DATE, REQUIREMENTS, ROADMAP } from "@/lib/version";
import { Card, Chip, type Tone } from "./hud/ui";

/* ---------- deep links: openGuide("propuneri") from anywhere ---------- */
let pendingSection: string | null = null;
export function openGuide(section?: string) {
  pendingSection = section ?? null;
  useUi.getState().setView("guide");
  if (section) requestAnimationFrame(() => document.getElementById(`ghid-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

const SECTIONS: [string, string][] = [
  ["bun-venit", "Bun venit"],
  ["primii-pasi", "Primii pași"],
  ["pagini", "Paginile aplicației"],
  ["zi-de-lucru", "O zi de lucru"],
  ["soferi", "Pentru șoferi"],
  ["cerinte", "Ce este nevoie"],
  ["versiune", "Versiunea și ce urmează"],
  ["propuneri", "Propuneri și probleme"],
  ["intrebari", "Întrebări frecvente"],
];

function Section({ id, icon, title, sub, children }: { id: string; icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div id={`ghid-${id}`} className="-mt-5 pt-5" />
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>
          {sub && <p className="text-[12.5px] text-slate-500">{sub}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

/** The onboarding and help page, in Romanian. */
export function GuideView() {
  useEffect(() => {
    if (pendingSection) document.getElementById(`ghid-${pendingSection}`)?.scrollIntoView({ block: "start" });
    pendingSection = null;
  }, []);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto grid max-w-[1180px] gap-4 p-3 sm:p-4 lg:grid-cols-[210px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-4 rounded-2xl bg-white/80 p-2 shadow-sm ring-1 ring-white">
            <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ghid · v{APP_VERSION_SHORT}</div>
            {SECTIONS.map(([id, label]) => (
              <button key={id} onClick={() => document.getElementById(`ghid-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] text-slate-600 hover:bg-blue-50 hover:text-blue-700">
                {label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <Welcome />
          <Checklist />
          <Pages />
          <WorkDay />
          <Drivers />
          <Requirements />
          <Versions />
          <FeedbackSection />
          <Faq />
          <p className="pb-6 text-center text-[11px] text-slate-400">
            Nobil Prest · Depozit & livrări · versiunea {APP_VERSION_SHORT} ({RELEASE_DATE})
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- 1. Welcome ---------- */
function Welcome() {
  return (
    <Card className="overflow-hidden">
      <div id="ghid-bun-venit" />
      <div className="bg-gradient-to-br from-[#2f6bff] to-[#1f3fb3] p-6 text-white">
        <div className="text-[12px] font-medium uppercase tracking-wider text-blue-100">Versiunea {APP_VERSION_SHORT} · {RELEASE_DATE}</div>
        <h1 className="mt-1 text-[24px] font-semibold leading-tight">Bun venit în Nobil Prest · Depozit & livrări</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] text-blue-50">
          Aplicația arată într-un singur loc depozitul, cele 16 mașini și livrările către instituții din toată Moldova: cine încarcă, cine e pe drum, ce s-a livrat și ce trebuie
          rezolvat. Șoferii confirmă livrările din telefon.
        </p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Vedeți tot", "Depozitul 3D, harta Moldovei, programul zilei și lista livrărilor."],
          ["Aflați la timp", "Alertele arată livrările după 18:00, stocul insuficient, problemele raportate."],
          ["Tipăriți", "Foaia de încărcare și foaia de parcurs pentru fiecare mașină."],
          ["Confirmați din teren", "Șoferii apasă „Livrat” sau „Problemă” pe telefon."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-slate-50 p-3">
            <div className="text-[13px] font-semibold text-slate-800">{t}</div>
            <div className="mt-0.5 text-[12px] text-slate-500">{d}</div>
          </div>
        ))}
      </div>
      <div className="mx-5 mb-5 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 ring-1 ring-amber-200">
        <b>Important:</b> comenzile, traseele și stocul sunt deocamdată <b>exemple</b> (date demo). Reale sunt deja: mașinile, instituțiile importate, locația depozitului, GPS-ul și
        confirmările șoferilor. Comenzile reale vin din 1C în versiunea 1.4.
      </div>
    </Card>
  );
}

/* ---------- 2. Checklist ---------- */
interface Info {
  version: string;
  data: { writable: boolean };
  auth: { office: boolean; driver: boolean; gpsToken: boolean };
  warehouseSet: boolean;
  fleetSaved: boolean;
  institutions: number;
  gps: { trackers: number; trackersLastDay: number; phonesLastDay: number };
  confirmations: { today: number; days: number };
  feedback: { total: number; open: number };
}

type Step = { ok: boolean | "warn" | "later"; title: string; detail: string; action?: [string, () => void] };

function Checklist() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState(false);
  const setView = useUi((s) => s.setView);
  const storage = useUi((s) => s.storage);
  useEffect(() => {
    fetch("/api/info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setError(true));
  }, []);
  const https = typeof window !== "undefined" && (window.location.protocol === "https:" || window.location.hostname === "localhost");

  const steps: Step[] = info
    ? [
        { ok: info.data.writable && storage === "server", title: "Serverul rulează și salvează datele", detail: info.data.writable ? "Datele se păstrează pe server, aceleași pe toate calculatoarele." : "Folderul de date nu poate fi scris. Verificați instalarea (DATA_DIR)." },
        { ok: info.auth.office && info.auth.driver ? true : "warn", title: "Parole pentru birou și șoferi", detail: info.auth.office && info.auth.driver ? "Accesul este protejat." : "Fără parole oricine are adresa poate intra. Scriptul de instalare le generează automat." },
        { ok: https ? true : "warn", title: "Adresă sigură (https://)", detail: https ? "Telefoanele pot trimite poziția GPS." : "Pe http:// telefoanele nu pot trimite GPS. Folosiți un domeniu (instalarea face HTTPS automat)." },
        { ok: info.warehouseSet, title: "Locația depozitului", detail: info.warehouseSet ? "Setată." : "Introduceți coordonatele depozitului pe pagina Date.", action: ["Date", () => setView("data")] },
        { ok: info.fleetSaved, title: "Fișele mașinilor", detail: info.fleetSaved ? "Flota a fost salvată. Verificați modelele, capacitățile și șoferii." : "Completați modelul, capacitatea, șoferul și telefonul pentru fiecare mașină.", action: ["Flota", () => setView("data")] },
        { ok: info.institutions > 0, title: "Lista instituțiilor", detail: info.institutions > 0 ? `${info.institutions} instituții importate.` : "Încărcați Excel-ul cu instituțiile (export din 1C) pe pagina Date.", action: ["Importă", () => setView("data")] },
        { ok: info.gps.trackersLastDay > 0 ? true : info.gps.phonesLastDay > 0 ? "warn" : false, title: "GPS de la furnizor", detail: info.gps.trackersLastDay > 0 ? `${info.gps.trackersLastDay} ${info.gps.trackersLastDay === 1 ? "tracker a trimis" : "trackere au trimis"} poziții în ultimele 24 h.` : "Furnizorul GPS trebuie să trimită pozițiile la /api/gps (vezi Ce este nevoie)." },
        { ok: info.confirmations.days > 0, title: "Primul șofer a confirmat o livrare", detail: info.confirmations.days > 0 ? `Confirmări în ${info.confirmations.days} ${info.confirmations.days === 1 ? "zi" : "zile"}, azi ${info.confirmations.today}.` : "Dați unui șofer adresa /sofer și parola, rugați-l să apese „Livrat” la o oprire.", action: ["Pentru șoferi", () => document.getElementById("ghid-soferi")?.scrollIntoView({ behavior: "smooth" })] },
        { ok: "later", title: "Comenzile din 1C", detail: "În versiunea 1.4: export automat din 1C 7.7. Până atunci comenzile sunt exemple." },
      ]
    : [];
  const done = steps.filter((s) => s.ok === true).length;
  const total = steps.filter((s) => s.ok !== "later").length;

  return (
    <Section id="primii-pasi" icon={<Rocket size={19} />} title="Primii pași" sub="Ce este gata și ce mai trebuie făcut ca aplicația să lucreze cu datele reale. Se verifică automat.">
      {error && <p className="text-[12.5px] text-rose-600">Nu am putut citi starea serverului. Dacă aplicația e deschisă fără server (doar demo), lista nu e disponibilă.</p>}
      {info && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="text-[12.5px] font-medium text-slate-700">
              {done} din {total} gata
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {steps.map((s) => (
              <li key={s.title} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5">
                  {s.ok === true ? <CheckCircle2 size={18} className="text-emerald-500" /> : s.ok === "warn" ? <CircleAlert size={18} className="text-amber-500" /> : s.ok === "later" ? <Circle size={18} className="text-slate-300" /> : <Circle size={18} className="text-rose-400" />}
                </span>
                <div className="flex-1">
                  <div className={`text-[13px] font-medium ${s.ok === "later" ? "text-slate-400" : "text-slate-800"}`}>{s.title}</div>
                  <div className="text-[12px] text-slate-500">{s.detail}</div>
                </div>
                {s.action && s.ok !== true && (
                  <button onClick={s.action[1]} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-blue-700 hover:bg-blue-50">
                    {s.action[0]}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/* ---------- 3. Pages ---------- */
function Pages() {
  const setView = useUi((s) => s.setView);
  const pages: [View, string, React.ReactNode, string, string][] = [
    ["warehouse", "Depozit", <Warehouse key="w" size={18} />, "1", "Depozitul 3D: rampele R1–R6, oficiul, camera frigorifică, rafturile și depozitul subteran. Mașinile intră, se încarcă și pleacă. 👁 arată interiorul. Click pe orice pentru detalii."],
    ["map", "Moldova", <MapIcon key="m" size={18} />, "2", "Harta cu mașinile și instituțiile. Linia plină = drum parcurs, punctată = de parcurs. Punct verde = livrat, roșu = problemă. „Live GPS” (pagina Date) arată pozițiile reale."],
    ["deliveries", "Livrări", <ListChecks key="l" size={18} />, "3", "Toate livrările zilei într-un tabel: căutare, filtre (Pe drum, Livrate, Probleme, După 18:00), confirmările șoferilor, export în Excel."],
    ["planning", "Program", <CalendarRange key="p" size={18} />, "4", "Ziua pe ore, câte un rând pe mașină: încărcare, drum, descărcări, întoarcere. De aici tipăriți toate foile odată."],
    ["data", "Date", <Database key="d" size={18} />, "5", "Setări: locația depozitului, fișele mașinilor, importul instituțiilor din Excel, starea GPS, grafica simplificată."],
    ["guide", "Ghid", <BookOpen key="g" size={18} />, "6", "Această pagină: primii pași, ce este nevoie, versiunea, propuneri și probleme."],
  ];
  return (
    <Section id="pagini" icon={<ClipboardList size={19} />} title="Paginile aplicației" sub="Butoanele din bara de sus sau tastele 1–6.">
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map(([v, name, icon, key, text]) => (
          <div key={v} className="flex gap-3 rounded-xl border border-slate-100 p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600">{icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-800">
                {name} <kbd className="rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-medium text-slate-500">{key}</kbd>
              </div>
              <p className="mt-0.5 text-[12px] text-slate-500">{text}</p>
              {v !== "guide" && (
                <button onClick={() => setView(v)} className="mt-1.5 text-[12px] font-medium text-blue-600 hover:underline">
                  Deschide →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["⚠ Alerte", "Butonul roșu/galben din dreapta sus: ce trebuie rezolvat azi. Click pe o alertă deschide mașina sau produsul."],
          ["🔔 Activitate", "Ce s-a întâmplat: încărcări, plecări, sosiri, livrări, în ordinea timpului."],
          ["🕘 Ceasul", "„Acum” = ora reală. 180×/600×/1800× derulează ziua mai repede (pentru demonstrație). Glisorul alege o oră. Spațiu = pauză."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-slate-50 p-3">
            <div className="text-[13px] font-semibold text-slate-800">{t}</div>
            <div className="mt-0.5 text-[12px] text-slate-500">{d}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- 4. A working day ---------- */
function WorkDay() {
  const steps = [
    ["Dimineața, înainte de încărcare", "Deschideți ⚠ Alerte: stoc insuficient, comenzi care nu încap, produse refrigerate în mașini nefrigorifice. Rezolvați-le înainte de plecare."],
    ["Pregătirea mașinilor", "Program → „Toate foile de încărcare”. Depozitul pregătește produsele pe zone; ultima livrare se încarcă prima."],
    ["Plecarea", "Dați fiecărui șofer foaia de parcurs. Șoferul deschide pagina Șofer pe telefon."],
    ["În timpul zilei", "Urmăriți harta și pagina Livrări. Confirmările șoferilor apar în ~15 secunde. Problemele (închis, refuzat) apar în Alerte."],
    ["Seara", "Livrări → „Excel (CSV)” pentru raport. Verificați ce a rămas nelivrat și mutați pe altă zi."],
  ];
  return (
    <Section id="zi-de-lucru" icon={<CalendarRange size={19} />} title="O zi de lucru" sub="Cum se folosește aplicația de la dimineață până seara.">
      <ol className="space-y-2.5">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-600 text-[12px] font-bold text-white">{i + 1}</span>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">{t}</div>
              <div className="text-[12.5px] text-slate-500">{d}</div>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ---------- 5. Drivers ---------- */
function Drivers() {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/sofer`;
    setUrl(u);
    import("qrcode")
      .then((m) => m.toDataURL(u, { margin: 1, width: 220, color: { dark: "#1f3fb3" } }))
      .then(setQr)
      .catch(() => setQr(null));
  }, []);
  return (
    <Section id="soferi" icon={<Smartphone size={19} />} title="Pentru șoferi" sub="Pagina Șofer se deschide pe telefon. Nu trebuie instalat nimic.">
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <ol className="list-decimal space-y-1.5 pl-5 text-[12.5px] text-slate-600">
          <li>
            Scanați codul QR cu camera telefonului sau deschideți <b className="text-slate-800">{url || "/sofer"}</b>.
          </li>
          <li>
            Utilizator <b className="text-slate-800">sofer</b>, parola pentru șoferi (o primiți de la cel care a instalat serverul).
          </li>
          <li>Alegeți numărul mașinii o singură dată. Telefonul îl ține minte.</li>
          <li>Adăugați pe ecranul principal: Chrome → meniu ⋮ → „Adaugă pe ecranul de pornire” (Android), sau Partajează → „Pe ecranul principal” (iPhone).</li>
          <li>
            La fiecare oprire: <b>Maps/Waze</b> pentru drum, <b>Sună</b>, apoi <b>Am ajuns</b> → <b>Livrat</b>. Dacă nu se poate livra: <b>Problemă</b> și motivul.
          </li>
          <li>Fără semnal? Apăsați oricum. Se trimite automat când revine internetul.</li>
          <li>
            Mașinile fără tracker (acum 4, 5, 12): activați <b>Trimite poziția din telefon</b> și lăsați pagina deschisă în timpul cursei.
          </li>
        </ol>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-3">
          {qr ? <img src={qr} alt="Cod QR pentru pagina Șofer" width={180} height={180} className="rounded-lg" /> : <div className="grid h-[180px] w-[180px] place-items-center text-[12px] text-slate-400">cod QR</div>}
          <div className="text-center text-[11px] text-slate-500">Scanați pentru pagina Șofer</div>
        </div>
      </div>
    </Section>
  );
}

/* ---------- 6. Requirements ---------- */
function Requirements() {
  return (
    <Section id="cerinte" icon={<Server size={19} />} title="Ce este nevoie pentru a funcționa" sub="Instalarea pe server durează ~30 de minute (vezi docs/GHID-INSTALARE.md, în limba română).">
      <div className="grid gap-3 sm:grid-cols-2">
        {REQUIREMENTS.map((g) => (
          <div key={g.title} className="rounded-xl border border-slate-100 p-3">
            <div className="mb-1 text-[13px] font-semibold text-slate-800">{g.title}</div>
            <ul className="list-disc space-y-1 pl-4 text-[12px] text-slate-600">
              {g.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-blue-50 p-3 text-[12px] text-blue-900 ring-1 ring-blue-100">
        <b>Pentru furnizorul GPS:</b> pozițiile se trimit prin <code className="rounded bg-white px-1">POST /api/gps</code> cu antetul{" "}
        <code className="rounded bg-white px-1">Authorization: Bearer &lt;cheia GPS&gt;</code>, de ex.{" "}
        <code className="rounded bg-white px-1">{`{"tracker":"059166","lat":47.02,"lng":28.83,"speed":42}`}</code>. Detalii tehnice: docs/INTEGRATIONS.md.
      </div>
    </Section>
  );
}

/* ---------- 7. Versions ---------- */
function Versions() {
  return (
    <Section id="versiune" icon={<Sparkles size={19} />} title={`Versiunea ${APP_VERSION_SHORT} și ce urmează`} sub="Fiecare versiune nouă aduce funcții noi. Propunerile voastre intră în versiunile următoare.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">Ce conține</div>
          <div className="space-y-3">
            {CHANGELOG.map((r, i) => (
              <div key={r.version} className={`rounded-xl p-3 ${i === 0 ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <Chip tone={i === 0 ? "green" : "gray"}>v{r.version}</Chip>
                  <span className="text-[13px] font-semibold text-slate-800">{r.title}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{r.date}</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-slate-600">
                  {r.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">Ce urmează</div>
          <div className="space-y-3">
            {ROADMAP.map((r) => (
              <div key={r.version} className="rounded-xl border border-dashed border-blue-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <Chip tone="blue">v{r.version}</Chip>
                  <span className="text-[13px] font-semibold text-slate-800">{r.title}</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-slate-600">
                  {r.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11.5px] text-amber-900">
                  <b>Ce trebuie de la voi:</b> {r.needs.join("; ")}.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------- 8. Suggestions & problems ---------- */
const KIND: Record<Feedback["kind"], [string, Tone]> = { problema: ["Problemă", "red"], propunere: ["Propunere", "blue"], intrebare: ["Întrebare", "violet"] };
const PRIO: Record<Feedback["priority"], [string, Tone]> = { mica: ["mică", "gray"], medie: ["medie", "amber"], mare: ["mare", "red"] };
const STATUS: Record<Feedback["status"], [string, Tone]> = { nou: ["Nou", "blue"], "in-lucru": ["În lucru", "amber"], planificat: ["Planificat", "violet"], rezolvat: ["Rezolvat", "green"], respins: ["Nu se face", "gray"] };
const PAGES = ["General", "Depozit", "Moldova", "Livrări", "Program", "Date", "Șofer", "Foi tipărite", "Alerte"];
const NAME_KEY = "nobilprest.feedbackName";

function FeedbackSection() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [form, setForm] = useState({ name: "", kind: "propunere" as Feedback["kind"], page: "General", priority: "medie" as Feedback["priority"], text: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(() => {
    fetch("/api/feedback", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setItems(j.items))
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
    try {
      setForm((f) => ({ ...f, name: localStorage.getItem(NAME_KEY) ?? "" }));
    } catch {
      // ignore
    }
  }, [load]);

  async function send() {
    setMsg(null);
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    if (!res?.ok) {
      setMsg((await res?.json().catch(() => null))?.error ?? "Nu s-a putut trimite. Încercați din nou.");
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, form.name);
    } catch {
      // ignore
    }
    setForm((f) => ({ ...f, text: "" }));
    setMsg("Mulțumim! A fost înregistrată mai jos.");
    load();
  }

  async function update(id: string, patch: { status?: Feedback["status"]; reply?: string }) {
    await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) }).catch(() => null);
    load();
  }

  const shown = useMemo(() => (items ?? []).filter((f) => filter === "all" || f.status === "nou" || f.status === "in-lucru" || f.status === "planificat"), [items, filter]);

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Data", "Tip", "Prioritate", "Pagina", "Nume", "De la", "Descriere", "Stare", "Răspuns", "Versiune"];
    const lines = (items ?? []).map((f) => [new Date(f.ts).toLocaleString("ro-MD"), KIND[f.kind][0], PRIO[f.priority][0], f.page, f.name, f.from, f.text, STATUS[f.status][0], f.reply ?? "", f.version].map(esc).join(";"));
    const blob = new Blob(["﻿" + [head.map(esc).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `propuneri-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const input = "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] outline-none focus:border-blue-300";
  return (
    <Section id="propuneri" icon={<MessageSquarePlus size={19} />} title="Propuneri și probleme" sub="Spuneți ce lipsește, ce nu merge sau ce ar ușura munca. Totul se adună aici și intră în versiunile următoare.">
      <div className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-[12px] text-slate-600 sm:grid-cols-4">
        {[
          ["1. Scrieți", "Ce pagină, ce ați vrut să faceți, ce s-a întâmplat. Un exemplu ajută (mașina, instituția, ora)."],
          ["2. Se adună", "Toate propunerile apar în lista de mai jos, vizibile pentru tot oficiul."],
          ["3. Se planifică", "Responsabilul marchează: În lucru, Planificat (cu versiunea), Rezolvat sau Nu se face."],
          ["4. Versiune nouă", "La fiecare versiune nouă, ce s-a rezolvat apare la „Versiunea și ce urmează”."],
        ].map(([t, d]) => (
          <div key={t}>
            <div className="font-semibold text-slate-800">{t}</div>
            <div>{d}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <input className={input} placeholder="Numele dvs." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Feedback["kind"] })}>
          <option value="propunere">Propunere (ceva nou)</option>
          <option value="problema">Problemă (nu merge)</option>
          <option value="intrebare">Întrebare</option>
        </select>
        <select className={input} value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })}>
          {PAGES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Feedback["priority"] })}>
          <option value="mica">Prioritate mică</option>
          <option value="medie">Prioritate medie</option>
          <option value="mare">Prioritate mare (blochează munca)</option>
        </select>
      </div>
      <textarea
        className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white p-3 text-[12.5px] outline-none focus:border-blue-300"
        placeholder="Ex.: „Pe foaia de parcurs aș vrea și numărul de telefon al directorului grădiniței.” sau „La Mașina 7 nu apare poziția GPS de la ora 10.”"
        value={form.text}
        onChange={(e) => setForm({ ...form, text: e.target.value })}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={() => void send()} disabled={form.text.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-blue-700 disabled:opacity-40">
          <Send size={13} /> Trimite
        </button>
        {msg && <span className="text-[12px] text-slate-600">{msg}</span>}
        <span className="ml-auto flex items-center gap-1">
          {(
            [
              ["open", "Deschise"],
              ["all", "Toate"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-2 py-1 text-[12px] ${filter === k ? "bg-blue-50 font-medium text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
              {l}
            </button>
          ))}
          <button onClick={exportCsv} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-50">
            <Download size={12} /> Excel
          </button>
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {items === null && <li className="text-[12px] text-slate-400">Se încarcă…</li>}
        {items && shown.length === 0 && <li className="rounded-xl bg-slate-50 p-3 text-center text-[12px] text-slate-400">Nicio propunere {filter === "open" ? "deschisă" : ""} încă.</li>}
        {shown.map((f) => (
          <li key={f.id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
              <Chip tone={KIND[f.kind][1]}>{KIND[f.kind][0]}</Chip>
              <Chip tone={PRIO[f.priority][1]}>prioritate {PRIO[f.priority][0]}</Chip>
              <span>
                · {f.page} · {f.name} {f.from === "sofer" ? "(șofer)" : ""} · {new Date(f.ts).toLocaleString("ro-MD", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · v{f.version.replace(/\.0$/, "")}
              </span>
              <select value={f.status} onChange={(e) => void update(f.id, { status: e.target.value as Feedback["status"] })} className="ml-auto h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[11.5px] text-slate-700" aria-label="Starea">
                {Object.entries(STATUS).map(([k, [l]]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-slate-800">{f.text}</p>
            <input
              defaultValue={f.reply ?? ""}
              placeholder="Răspuns / notă (ex. „în versiunea 1.3”)…"
              onBlur={(e) => e.target.value !== (f.reply ?? "") && void update(f.id, { reply: e.target.value })}
              className="mt-2 h-8 w-full rounded-lg border border-transparent bg-slate-50 px-2 text-[12px] text-slate-700 outline-none focus:border-blue-200 focus:bg-white"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- 9. FAQ ---------- */
function Faq() {
  const qa: [string, string][] = [
    ["De ce comenzile nu sunt cele reale?", "Comenzile se introduc în 1C. Legătura automată cu 1C 7.7 vine în versiunea 1.4. Până atunci aplicația folosește comenzi exemplu, ca să puteți vedea cum funcționează totul."],
    ["Depozitul 3D sau harta nu se afișează.", "Calculatorul nu are accelerare grafică (WebGL). Actualizați Chrome/Edge și driverul plăcii video. Între timp folosiți Livrări, Program și Date. Pe calculatoare mai slabe bifați „Grafică simplificată” pe pagina Date."],
    ["O mașină nu apare pe hartă în modul Live GPS.", "Mașina apare doar dacă a trimis o poziție în ultimele 15 minute. Verificați pe pagina Date → GPS în timp real. Mașinile 4, 5 și 12 nu au tracker funcțional: șoferul trebuie să activeze GPS-ul din telefon."],
    ["Șoferul a apăsat „Livrat” dar nu apare.", "Confirmările apar în ~15 secunde. Dacă telefonul era fără internet, se trimit când revine semnalul (pe pagina Șofer apare „netrimise”)."],
    ["Cum schimb datele unei mașini?", "Date → Flota: modificați și apăsați „Salvează flota”. Se aplică pe toate calculatoarele."],
    ["Cum adaug o mașină nouă?", "Date → Flota → „Adaugă mașină”, completați și salvați. Primește următorul număr liber."],
    ["Se pierd datele dacă serverul se repornește?", "Nu. Totul e în folderul data/ de pe server. Scriptul de backup face o copie zilnică."],
    ["Cum aflu ce s-a schimbat într-o versiune nouă?", "După actualizare apare automat fereastra „Ce e nou”. Detaliile sunt la „Versiunea și ce urmează”."],
    ["Cine poate vedea aplicația?", "Doar cine are parola de birou. Șoferii au o parolă separată și văd doar pagina Șofer."],
  ];
  return (
    <Section id="intrebari" icon={<AlertTriangle size={19} />} title="Întrebări frecvente">
      <div className="divide-y divide-slate-100">
        {qa.map(([q, a]) => (
          <details key={q} className="group py-2.5">
            <summary className="cursor-pointer list-none text-[13px] font-medium text-slate-800 marker:hidden">
              <span className="mr-1 inline-block text-slate-400 transition group-open:rotate-90">›</span> {q}
            </summary>
            <p className="mt-1 pl-4 text-[12.5px] text-slate-600">{a}</p>
          </details>
        ))}
      </div>
      {DATA_SOURCE.institutions === "demo" && <p className="mt-3 text-[11.5px] text-slate-400">Ați găsit o întrebare care lipsește? Scrieți-o la „Propuneri și probleme”.</p>}
    </Section>
  );
}
