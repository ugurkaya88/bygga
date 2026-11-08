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
}

/** Every brand's name, theme colour and exits; BRAND_INFO is the one this deployment wears. */
export const BRANDS: Record<BrandId, BrandInfo> = {
  bygga: { name: "Bygga", themeColor: "#f5f4f0", exits: true },
  rehber: { name: "rehber", themeColor: "#f7f1e9", exits: false },
};

export const BRAND_INFO: BrandInfo = BRANDS[BRAND];

/**
 * A product name the way the brand shows it. Bygga keeps the maker's capitals; rehber writes it in sentence case
 * with Turkish rules for the dotted and dotless i ("KARMATO" gives "Karmato", "KİTAPLIK" gives "Kitaplık").
 */
export function displayName(name: string): string {
  if (BRAND !== "rehber") return name;
  const low = name.toLocaleLowerCase("tr");
  return low.charAt(0).toLocaleUpperCase("tr") + low.slice(1);
}
