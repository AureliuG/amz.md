/**
 * Where the app is served. "" for the Node server at the domain root; e.g. "/delivery" for the
 * web-hosting package (scripts/pachet-gazduire.sh), which is static files + a small PHP API in a subfolder.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Address of an API route, e.g. api("/api/state"). */
export const api = (path: string) => BASE + path;

/** Address of a page, e.g. page("/sofer"). The hosting package uses folders, so it ends with "/". */
export const page = (path: string) => (BASE ? `${BASE}${path}/` : path);

/** The web-hosting package logs in with an access code (one page) instead of a browser password prompt. */
export const ACCESS_BY_CODE = process.env.NEXT_PUBLIC_ACCESS === "cod";
