/**
 * Whose look the guide player wears, fixed per deployment by NEXT_PUBLIC_BRAND ("bygga" or "rehber"). Next.js
 * inlines the variable at build time, like NEXT_PUBLIC_LOCALE, so the server and the browser always agree; unset
 * gives Bygga's own look. "rehber" is a warm theme for guides reached from a QR code on the box: its own name and
 * mark, and no ways out into Bygga's pages. Its name is a working name, swapped here in one place.
 */
export type BrandId = "bygga" | "rehber";

export const BRAND: BrandId = process.env.NEXT_PUBLIC_BRAND === "rehber" ? "rehber" : "bygga";

export interface BrandInfo {
  /** the name shown in titles and the header */
  name: string;
  /** the browser's theme colour: the page ground */
  themeColor: string;
  /** whether guide screens link out to the rest of the site (home, browse, workshop, scan) */
  exits: boolean;
  /** whether the safety warnings (SAFETY_WARNINGS in components/art/Icons.tsx) get a card of their own, in red */
  safetyCards: boolean;
}

/** Every brand's name, theme colour and exits; BRAND_INFO is the one this deployment wears. */
export const BRANDS: Record<BrandId, BrandInfo> = {
  bygga: { name: "Bygga", themeColor: "#f5f4f0", exits: true, safetyCards: false },
  rehber: { name: "rehber", themeColor: "#f7f1e9", exits: false, safetyCards: true },
};

export const BRAND_INFO: BrandInfo = BRANDS[BRAND];

/**
 * A product name the way the brand shows it. Bygga keeps the maker's capitals. Rehber shows a name written in normal
 * case as it is written ("Makyaj Masası 1747", "Billy"): the casing of a Latin name cannot be guessed (the I of
 * "STANDI" is a Turkish dotless one, the I of "BILLY" is not), so authors write it as a buyer would. A name in all
 * capitals is recased word by word with Turkish rules, the first word with a capital ("KARMATO" gives "Karmato",
 * "KİTAPLIK" gives "Kitaplık"), and a word of up to three letters is kept as it is, since it is most likely an
 * abbreviation ("ELİTE TV STANDI" gives "Elite TV standı", "MDF RAF" stays).
 */
export function displayName(name: string): string {
  if (BRAND !== "rehber") return name;
  if (/\p{Ll}/u.test(name) || !/\p{Lu}/u.test(name)) return name;
  return name.replace(/\S+/g, (word, at: number) => {
    if ((word.match(/\p{L}/gu)?.length ?? 0) <= 3) return word;
    const low = word.toLocaleLowerCase("tr");
    return at === 0 ? low.replace(/\p{L}/u, (c) => c.toLocaleUpperCase("tr")) : low;
  });
}
