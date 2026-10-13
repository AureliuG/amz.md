/**
 * Minimal file storage for a single-server install (office PC or small VPS).
 * Everything lives in DATA_DIR (default ./data): JSON documents + one NDJSON log per day.
 * Back up that folder; delete a file to reset that part.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const queues = new Map<string, Promise<unknown>>();

/** Serialise writes per file so concurrent requests can't interleave. */
function enqueue<T>(file: string, job: () => Promise<T>): Promise<T> {
  const prev = queues.get(file) ?? Promise.resolve();
  const next = prev.then(job, job);
  queues.set(file, next.catch(() => undefined));
  return next;
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(name: string, value: unknown): Promise<void> {
  const file = path.join(DIR, name);
  return enqueue(file, async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value));
    await fs.rename(tmp, file);
  });
}

/** Read-modify-write a JSON document without losing concurrent updates. */
export function updateJson<T>(name: string, fallback: T, fn: (current: T) => T): Promise<T> {
  const file = path.join(DIR, name);
  return enqueue(file, async () => {
    let current = fallback;
    try {
      current = JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch {
      // first write
    }
    const next = fn(current);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next));
    await fs.rename(tmp, file);
    return next;
  });
}

/** Can we write to the data folder? (shown on the Ghid checklist) */
export async function dataDirStatus(): Promise<{ dir: string; writable: boolean }> {
  try {
    await fs.mkdir(DIR, { recursive: true });
    const probe = path.join(DIR, `.probe-${process.pid}`);
    await fs.writeFile(probe, "ok");
    await fs.rm(probe);
    return { dir: DIR, writable: true };
  } catch {
    return { dir: DIR, writable: false };
  }
}

/** Days that have a file in data/<kind>/ (daily logs are .ndjson, daily documents .json). */
export async function listDays(kind: string, ext = ".ndjson"): Promise<string[]> {
  try {
    return (await fs.readdir(path.join(DIR, kind))).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort();
  } catch {
    return [];
  }
}

export function appendLog(kind: string, day: string, entries: unknown[]): Promise<void> {
  if (!entries.length) return Promise.resolve();
  const file = path.join(DIR, kind, `${day}.ndjson`);
  return enqueue(file, async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  });
}

export async function readLog<T>(kind: string, day: string): Promise<T[]> {
  try {
    const text = await fs.readFile(path.join(DIR, kind, `${day}.ndjson`), "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as T];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

/** Calendar day in Moldova (YYYY-MM-DD), whatever the server's timezone. */
export const dayOf = (ms: number = Date.now()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Chisinau" }).format(new Date(ms));
export const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
