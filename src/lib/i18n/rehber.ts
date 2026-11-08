import type en from "./en";
import { BRANDS } from "@/lib/brand";

const NAME = BRANDS.rehber.name;

/**
 * The warm theme's own Turkish words, laid over tr.ts when NEXT_PUBLIC_BRAND is "rehber": the strings that name
 * Bygga name the brand instead. Everything else comes from tr.ts, so Bygga's own strings stay untouched.
 */
export const REHBER_TR: Partial<Record<keyof typeof en, string>> = {
  "meta.stepTitle": `Adım {n}/{total}, {name} | ${NAME}`,
  "meta.doneTitle": `Kuruldu: {name} | ${NAME}`,
  "meta.coverTitle": `{name} {variant}: adım adım montaj | ${NAME}`,
  "meta.buildTitle": `{name}: adım adım montaj | ${NAME}`,
  "meta.scannedTitle": `Taranmış kılavuz | ${NAME}`,
  "meta.printTitle": `Yazdır: {name} | ${NAME}`,
  "key.sub": "Yapay zekâ özellikleri kendi Together AI anahtarınla çalışır.",
  "key.safe": `Bu tarayıcıda kalır. ${NAME} bunu hiçbir yerde saklamaz.`,
};
