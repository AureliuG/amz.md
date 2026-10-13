/** Products and stock helpers shared by the Stoc page, alerts, panels and the loading confirmation. */
import { PRODUCT_BY_ID, PRODUCTS } from "./seed";
import type { OrderLine, Product } from "./types";

/** The built-in product list (used until the company saves its own list on the Stoc page). */
export const BUILTIN_PRODUCTS: Product[] = PRODUCTS.map((p) => ({ ...p }));

/** Swap the product list in place (like the institutions), so every module keeps the same references. */
export function replaceProducts(list: Product[] | null) {
  const next = list?.length ? list : BUILTIN_PRODUCTS;
  PRODUCTS.splice(0, PRODUCTS.length, ...next.map((p) => ({ ...p })));
  PRODUCT_BY_ID.clear();
  PRODUCTS.forEach((p) => PRODUCT_BY_ID.set(p.id, p));
}

export type Levels = Record<string, number>;

/** Current quantity of a product: the saved level, or the starting value until the first stock operation. */
export const levelOf = (levels: Levels | null, id: string) => levels?.[id] ?? PRODUCT_BY_ID.get(id)?.stock ?? 0;
/** Starting levels sent with the first stock operation. */
export const baseLevels = (): Levels => Object.fromEntries(PRODUCTS.map((p) => [p.id, p.stock]));

/** Total quantity per product of a set of lines. */
export function sumLines(lines: OrderLine[]): Map<string, number> {
  const m = new Map<string, number>();
  lines.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty));
  return m;
}
export const mergeLines = (lines: OrderLine[]): OrderLine[] => [...sumLines(lines)].map(([productId, qty]) => ({ productId, qty: Math.round(qty * 1000) / 1000 }));

export const unitLabel = (u: string) => (u === "pcs" ? "buc" : u);
export const fmtQty = (n: number) => (Math.round(n * 10) / 10).toLocaleString("ro-MD");

export const ZONE_LABEL: Record<Product["zone"], string> = { cellar: "Beci (legume, fructe)", cold: "Frigider", dry: "Produse uscate" };
export const ZONE_SHORT: Record<Product["zone"], string> = { cellar: "Beci", cold: "Frig", dry: "Uscate" };
