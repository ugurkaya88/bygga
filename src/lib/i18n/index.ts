import en from "./en";
import tr from "./tr";
import { REHBER_TR } from "./rehber";
import { BRAND } from "@/lib/brand";

export type Locale = "en" | "tr";
export type Key = keyof typeof en;

/** The words under a plural pair: "parts.missing.one" and "parts.missing.other" share "parts.missing". */
export type PluralKey = Key extends infer K ? (K extends `${infer B}.one` ? B : never) : never;

/**
 * The language of the interface, fixed per deployment by NEXT_PUBLIC_LOCALE ("en" or "tr"). Next.js inlines the
 * variable at build time, so the server and the browser always agree and English stays the default.
 */
export const LOCALE: Locale = process.env.NEXT_PUBLIC_LOCALE === "tr" ? "tr" : "en";

// the warm theme's own words (rehber.ts) come first in Turkish; Bygga's tables stay as they are
const DICT: Record<Key, string> = LOCALE === "tr" ? (BRAND === "rehber" ? { ...tr, ...REHBER_TR } : tr) : en;

export type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** The text for a key, with `{name}` placeholders filled from vars. Usable from components and plain TypeScript. */
export function t(key: Key, vars?: Vars): string {
  return fill(DICT[key] ?? en[key], vars);
}

/**
 * A text that depends on a count: `base.one` for exactly one, `base.other` otherwise. `{n}` is the count.
 * Turkish keeps the noun singular after a number, so its two texts are the same sentence.
 */
export function tn(base: PluralKey, n: number, vars?: Vars): string {
  return t(`${base}.${n === 1 ? "one" : "other"}` as Key, { n, ...vars });
}

/** A number the way the locale writes it (Turkish uses a decimal comma). */
export function num(n: number): string {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: 2 });
}

/** Lower and upper case that follow the locale's own rules (Turkish dotted and dotless i). */
export const lower = (s: string) => s.toLocaleLowerCase(LOCALE);
export const upper = (s: string) => s.toLocaleUpperCase(LOCALE);

/** A date such as "6 Nov", written for the locale. */
export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

/** "45 min", "2 h", "1 h 30 min": minutes the way the cover and the print view write them. */
export function fmtMin(m: number): string {
  if (m < 60) return t("time.min", { n: m });
  const h = Math.floor(m / 60), r = m % 60;
  return r ? t("time.hMin", { h, m: r }) : t("time.h", { n: h });
}

/** Where to look for the maker's own assembly manual: a web search that names no shop, in Turkish. */
export function manualSearchUrl(name: string): string {
  return LOCALE === "tr" ? `https://www.google.com/search?q=${encodeURIComponent(name + " montaj kılavuzu")}` : `https://www.ikea.com/search/?q=${encodeURIComponent(name)}`;
}

/** Like t(), for a key built from data that may have no entry: the fallback (the English label that came with the data) stands in. */
export function tOr(key: string, fallback: string): string {
  return key in en ? t(key as Key) : fallback;
}
