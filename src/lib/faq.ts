import type { StepKind } from "./types";
import { t, type Key } from "./i18n";

export interface Faq {
  q: string;
  a: string;
}

/** The questions under a step kind: `faq.<kind>.<n>.q` and `.a` in the dictionaries. */
const COUNTS: Partial<Record<StepKind, number>> = {
  dowels: 3,
  bolts: 2,
  cams: 3,
  nails: 2,
  square: 2,
  flip: 1,
  standup: 1,
  shelves: 2,
  anchor: 3,
  drawer: 2,
  runners: 1,
  legs: 2,
  doors: 2,
  hinges: 1,
  slats: 1,
  join: 2,
  screws: 2,
};

const ask = (base: string): Faq => ({ q: t(`${base}.q` as Key), a: t(`${base}.a` as Key) });

export function faqFor(kind: StepKind): Faq[] {
  const own = Array.from({ length: COUNTS[kind] ?? 0 }, (_, i) => ask(`faq.${kind}.${i + 1}`));
  return [...own, ask("faq.missing"), ask("faq.earlier")];
}
