"use client";

import maplibregl from "maplibre-gl";
import type { GeoJSONSource, LayerSpecification, Map as MLMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { arcLine, arcPoint } from "@/lib/geo";
import { INSTITUTION_BY_ID, INSTITUTIONS, WAREHOUSE } from "@/lib/seed";
import { stopStatus, truckState } from "@/lib/sim";
import { useUi } from "@/lib/store";
import type { LngLat, Truck } from "@/lib/types";

/**
 * Self-contained pastel style: country shapes ship with the app, so the map always renders.
 * When the OpenFreeMap tiles are reachable we add roads and place names on top.
 */
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    region: { type: "geojson", data: "/geo/region.json" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#dfe6f4" } },
    { id: "neighbours", type: "fill", source: "region", filter: ["!=", ["get", "code"], "MD"], paint: { "fill-color": "#e9edf6" } },
    { id: "md-shadow", type: "line", source: "region", filter: ["==", ["get", "code"], "MD"], paint: { "line-color": "#9fb0d6", "line-width": 14, "line-blur": 12, "line-translate": [4, 8], "line-opacity": 0.7 } },
    { id: "md", type: "fill", source: "region", filter: ["==", ["get", "code"], "MD"], paint: { "fill-color": "#f9fbff" } },
    // Moldova as a raised "game board" tile at country zoom, flattening as you zoom in.
    {
      id: "md-tile",
      type: "fill-extrusion",
      source: "region",
      filter: ["==", ["get", "code"], "MD"],
      paint: { "fill-extrusion-color": "#f7f9ff", "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 6, 5000, 8.5, 0], "fill-extrusion-opacity": 1, "fill-extrusion-vertical-gradient": true },
    },
    { id: "md-border", type: "line", source: "region", filter: ["==", ["get", "code"], "MD"], paint: { "line-color": "#7f9bdc", "line-width": 1.6 } },
  ],
};

/** Roads, water and place names from OpenFreeMap, added only when the tile server is reachable. */
const TILE_URL = "https://tiles.openfreemap.org/planet";
const TILE_LAYERS = [
    { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#cfe0fb" } },
    { id: "roads-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 9, filter: ["in", ["get", "class"], ["literal", ["tertiary", "minor"]]], paint: { "line-color": "#e3e8f3", "line-width": 1 } },
    { id: "roads-main", type: "line", source: "omt", "source-layer": "transportation", filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]], paint: { "line-color": "#d4dcee", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 12, 3] } },
    {
      id: "places",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: { "text-field": ["coalesce", ["get", "name:ro"], ["get", "name:latin"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": ["match", ["get", "class"], "city", 13, 11] },
      paint: { "text-color": "#6b7894", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    },
] as LayerSpecification[];

async function addStreetTiles(map: MLMap) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(TILE_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    map.setGlyphs("https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf");
    map.addSource("omt", { type: "vector", url: TILE_URL });
    for (const layer of TILE_LAYERS) map.addLayer(layer, layer.type === "symbol" ? "routes-casing" : "md-border");
  } catch {
    // Offline or blocked: the built-in country map is enough.
  }
}

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

function routeFeatures(trucks: Truck[]) {
  return fc(
    trucks.map((t) => {
      const pts: LngLat[] = [WAREHOUSE, ...t.stops.map((s) => INSTITUTION_BY_ID.get(s.institutionId)!.pos), WAREHOUSE];
      const line = pts.slice(1).flatMap((p, i) => arcLine(pts[i], p, 14));
      return { type: "Feature", properties: { id: t.id, color: t.color }, geometry: { type: "LineString", coordinates: line } };
    }),
  );
}

/** The part of each route already driven, so progress reads at a glance. */
function traveledFeatures(trucks: Truck[], t: number) {
  return fc(
    trucks.flatMap((tr) => {
      if (t <= tr.departAt) return [];
      const pts: LngLat[] = [WAREHOUSE, ...tr.stops.map((s) => INSTITUTION_BY_ID.get(s.institutionId)!.pos), WAREHOUSE];
      const line: LngLat[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const start = i === 0 ? tr.departAt : tr.stops[i - 1].leaveAt;
        const end = i < tr.stops.length ? tr.stops[i].arriveAt : tr.returnAt;
        if (t <= start) break;
        const p = Math.min(1, (t - start) / (end - start));
        for (let j = 0; j <= 14; j++) line.push(arcPoint(pts[i], pts[i + 1], (j / 14) * p));
        if (p < 1) break;
      }
      return line.length > 1 ? [{ type: "Feature" as const, properties: { id: tr.id, color: tr.color }, geometry: { type: "LineString" as const, coordinates: line } }] : [];
    }),
  );
}

function institutionFeatures(trucks: Truck[], t: number) {
  const today = new Map<string, { status: string; truck: string; color: string }>();
  trucks.forEach((tr) => tr.stops.forEach((s, i) => today.set(s.institutionId, { status: stopStatus(tr, i, t), truck: tr.id, color: tr.color })));
  return fc(
    INSTITUTIONS.map((inst) => {
      const d = today.get(inst.id);
      return { type: "Feature", properties: { id: inst.id, name: inst.name, type: inst.type, status: d?.status ?? "none", color: d?.color ?? "#9aa6c0", truck: d?.truck ?? "" }, geometry: { type: "Point", coordinates: inst.pos } };
    }),
  );
}

export default function MoldovaMap() {
  const active = useUi((s) => s.view === "map");
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [28.55, 47.0],
      zoom: 7,
      pitch: 45,
      bearing: -8,
      maxBounds: [
        [24.5, 44.6],
        [32.5, 49.4],
      ],
      attributionControl: { compact: true, customAttribution: "© OpenStreetMap contributors · OpenFreeMap" },
    });
    mapRef.current = map;
    // Truck name labels only when zoomed in (or for the selected truck); badges carry the number.
    const syncLabels = () => el.current?.classList.toggle("show-truck-labels", map.getZoom() >= 8.6);
    map.on("zoom", syncLabels);
    syncLabels();
    // Tiles are optional decoration: if they fail, keep the self-contained base map quietly.
    map.on("error", () => undefined);

    const truckEls = new Map<string, { marker: maplibregl.Marker; el: HTMLDivElement; arrow: HTMLSpanElement }>();
    let lastMinute = -1;

    map.on("load", () => {
      const { trucks, t } = useUi.getState();
      map.addSource("routes", { type: "geojson", data: routeFeatures(trucks) });
      map.addSource("insts", { type: "geojson", data: institutionFeatures(trucks, t) });
      map.addLayer({ id: "routes-casing", type: "line", source: "routes", paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": ["get", "color"], "line-width": 2.2, "line-opacity": 0.55, "line-dasharray": [2, 1.5] }, layout: { "line-cap": "round" } });
      map.addSource("traveled", { type: "geojson", data: traveledFeatures(trucks, t) });
      map.addLayer({ id: "traveled", type: "line", source: "traveled", paint: { "line-color": ["get", "color"], "line-width": 3.5, "line-opacity": 0.95 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "insts-pulse", type: "circle", source: "insts", filter: ["==", ["get", "status"], "unloading"], paint: { "circle-radius": 10, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#f59e0b", "circle-stroke-width": 2, "circle-stroke-opacity": 0.8 } });
      map.addLayer({
        id: "insts-other",
        type: "circle",
        source: "insts",
        filter: ["==", ["get", "status"], "none"],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1.6, 11, 4], "circle-color": "#a9b4cc", "circle-opacity": 0.7 },
      });
      map.addLayer({
        id: "insts-today",
        type: "circle",
        source: "insts",
        filter: ["!=", ["get", "status"], "none"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 11, 8],
          "circle-color": ["match", ["get", "status"], "delivered", "#16a34a", "unloading", "#f59e0b", ["get", "color"]],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.6,
        },
      });
      void addStreetTiles(map);
      map.addLayer({ id: "insts-selected", type: "circle", source: "insts", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 14, "circle-color": "rgba(47,107,255,0.15)", "circle-stroke-color": "#2f6bff", "circle-stroke-width": 2 } });

      const pickInst = (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) useUi.getState().select({ kind: "institution", id });
      };
      for (const layer of ["insts-today", "insts-other"]) {
        map.on("click", layer, pickInst);
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      // Warehouse marker
      const wh = document.createElement("div");
      wh.className = "wh-marker";
      wh.innerHTML = `<div class="wh-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2"><path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8"/><path d="M7 17h10"/></svg></div><div class="wh-label">Depozit Nobil Prest</div>`;
      wh.addEventListener("click", (e) => {
        e.stopPropagation();
        useUi.getState().select({ kind: "warehouse" });
      });
      new maplibregl.Marker({ element: wh, anchor: "bottom" }).setLngLat(WAREHOUSE).addTo(map);

      syncTrucks(useUi.getState().trucks);
    });

    /** (Re)creates the numbered truck markers and route lines, e.g. after a truck is added. */
    function syncTrucks(trucks: Truck[]) {
      truckEls.forEach(({ marker }) => marker.remove());
      truckEls.clear();
      (map.getSource("routes") as GeoJSONSource | undefined)?.setData(routeFeatures(trucks));
      (map.getSource("traveled") as GeoJSONSource | undefined)?.setData(traveledFeatures(trucks, useUi.getState().t));
      lastMinute = -1;
      trucks.forEach((t) => {
        const div = document.createElement("div");
        div.className = "truck-marker";
        div.style.setProperty("--c", t.color);
        div.innerHTML = `<div class="truck-dot"><span class="truck-arrow"></span>${t.number}</div><div class="truck-label">${t.label}${t.plate ? ` · ${t.plate}` : ""}</div>`;
        div.addEventListener("click", (e) => {
          e.stopPropagation();
          useUi.getState().select({ kind: "truck", id: t.id });
        });
        const marker = new maplibregl.Marker({ element: div }).setLngLat(WAREHOUSE).addTo(map);
        truckEls.set(t.id, { marker, el: div, arrow: div.querySelector(".truck-arrow") as HTMLSpanElement });
      });
    }
    const unsubFleet = useUi.subscribe((s, prev) => {
      if (s.trucks !== prev.trucks && map.getSource("routes")) syncTrucks(s.trucks);
    });

    map.on("click", (e) => {
      if (!map.queryRenderedFeatures(e.point, { layers: ["insts-today", "insts-other"].filter((l) => map.getLayer(l)) }).length) useUi.getState().select(null);
    });

    // Animation: trucks every frame, institution colours once a sim-minute.
    let raf = 0;
    let pulseFrame = 0;
    const tick = () => {
      const { t, selection, trucks } = useUi.getState();
      if (map.isStyleLoaded() || map.getSource("insts")) {
        trucks.forEach((tr) => {
          const ref = truckEls.get(tr.id);
          if (!ref) return;
          const st = truckState(tr, t);
          ref.marker.setLngLat(st.pos);
          const away = !["parked", "loading", "done"].includes(st.status);
          ref.el.classList.toggle("is-home", !away);
          ref.el.classList.toggle("is-selected", selection?.kind === "truck" && selection.id === tr.id);
          ref.el.classList.toggle("is-unloading", st.status === "unloading");
          const moving = st.status === "driving" || st.status === "returning";
          ref.el.classList.toggle("is-moving", moving);
          if (moving) ref.arrow.style.transform = `rotate(${st.bearing - map.getBearing()}deg)`;
        });
        const minute = Math.floor(t);
        if (minute !== lastMinute) {
          lastMinute = minute;
          (map.getSource("insts") as GeoJSONSource | undefined)?.setData(institutionFeatures(trucks, t));
          (map.getSource("traveled") as GeoJSONSource | undefined)?.setData(traveledFeatures(trucks, t));
        }
      }
      // Pulse rings around stops being unloaded right now.
      if (map.getLayer("insts-pulse") && (pulseFrame = (pulseFrame + 1) % 2) === 0) {
        const ph = (performance.now() % 1600) / 1600;
        map.setPaintProperty("insts-pulse", "circle-radius", 8 + ph * 16);
        map.setPaintProperty("insts-pulse", "circle-stroke-opacity", 0.9 * (1 - ph));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Selection → highlight + camera.
    const unsub = useUi.subscribe((s, prev) => {
      if (s.selection === prev.selection || !map.getLayer("routes")) return;
      const sel = s.selection;
      const truckId = sel?.kind === "truck" ? sel.id : null;
      map.setPaintProperty("routes", "line-opacity", truckId ? ["case", ["==", ["get", "id"], truckId], 0.9, 0.1] : 0.55);
      map.setPaintProperty("traveled", "line-opacity", truckId ? ["case", ["==", ["get", "id"], truckId], 1, 0.15] : 0.95);
      map.setPaintProperty("routes", "line-width", truckId ? ["case", ["==", ["get", "id"], truckId], 4, 2] : 2.2);
      map.setFilter("insts-selected", ["==", ["get", "id"], sel?.kind === "institution" ? sel.id : ""]);
      if (truckId) {
        const tr = s.trucks.find((x) => x.id === truckId);
        if (!tr) return;
        const b = new maplibregl.LngLatBounds(WAREHOUSE, WAREHOUSE);
        tr.stops.forEach((st) => b.extend(INSTITUTION_BY_ID.get(st.institutionId)!.pos));
        map.fitBounds(b, { padding: { top: 140, bottom: 220, left: 80, right: 420 }, pitch: 45, duration: 900, maxZoom: 11 });
      } else if (sel?.kind === "institution") {
        map.easeTo({ center: INSTITUTION_BY_ID.get(sel.id)!.pos, zoom: Math.max(map.getZoom(), 10), duration: 800 });
      }
    });
    const unsubCam = useUi.subscribe((s, prev) => {
      if (s.cameraCmd === prev.cameraCmd || s.view !== "map") return;
      if (s.cameraCmd.action === "in") map.zoomIn();
      if (s.cameraCmd.action === "out") map.zoomOut();
      if (s.cameraCmd.action === "reset") map.easeTo({ center: [28.55, 47.0], zoom: 7, pitch: 45, bearing: -8 });
    });

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      unsubCam();
      unsubFleet();
      map.remove();
    };
  }, []);

  // The container may have been hidden while the page resized.
  useEffect(() => {
    if (active) mapRef.current?.resize();
  }, [active]);

  // MapLibre forces `position: relative` on its container, so size it explicitly.
  return <div ref={el} className="h-full w-full" />;
}
