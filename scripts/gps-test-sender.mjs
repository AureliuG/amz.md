// Sends fake positions for the trackers with GPS to /api/gps, to test the live map without the provider.
// Usage: node scripts/gps-test-sender.mjs [http://localhost:3000] [token]
const base = process.argv[2] ?? "http://localhost:3000";
const token = process.argv[3];
const trackers = ["059166", "065129", "059072", "065080", "059084", "068235", "062138", "009254", "059083", "068226", "068234", "068232", "068233"];
const center = [28.86, 47.01];
const state = trackers.map((t, i) => ({ tracker: t, a: (i / trackers.length) * Math.PI * 2, r: 0.05 + (i % 5) * 0.07 }));

async function tick() {
  const body = state.map((s) => {
    s.a += 0.01;
    return { tracker: s.tracker, lat: center[1] + Math.sin(s.a) * s.r, lng: center[0] + Math.cos(s.a) * s.r * 1.4, ts: new Date().toISOString(), speed: 40, heading: ((90 - (s.a * 180) / Math.PI) % 360 + 360) % 360 };
  });
  const res = await fetch(`${base}/api/gps`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  console.log(new Date().toLocaleTimeString(), res.status, await res.text());
}
await tick();
setInterval(tick, 5000);
