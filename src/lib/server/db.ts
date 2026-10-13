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
