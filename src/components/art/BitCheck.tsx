import { num } from "@/lib/i18n";

// Fills come from the theme (rehber/art.css); with no brand each falls back to Bygga's own colour.
const BODY = "var(--art-paper, #fff)";
const METAL = "var(--art-tool-metal, #ecebe6)";
const BIT = "var(--art-metal, #e3e5e7)";

/** A drill bit's size as the manuals print it: "Ø7 mm", with the locale's decimal comma when it isn't whole. */
export const bitSize = (mm: number) => `Ø${num(mm)} mm`;

/**
 * The manuals' boxed tip beside a drilling step: the front of a drill, its chuck and a twist bit with flutes, and the
 * bit's size over it. The bit is drawn a little thicker for a bigger size, within what reads at a glance.
 */
export function BitCheck({ bit, height = 64, className }: { bit: number; height?: number; className?: string }) {
  const line = { stroke: "var(--ink)", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;
  const fine = { stroke: "var(--ink)", strokeWidth: 1, strokeLinecap: "round", opacity: 0.7 } as const;
  const W = 150, H = 66;
  const cy = 36;
  const r = Math.min(5.5, Math.max(2.4, 1.4 + bit * 0.4));
  const x0 = 62, tipStart = 126, tip = 134;
  const flutes = [];
  for (let x = x0 + 5; x < tipStart - 2; x += 6) flutes.push(<path key={x} d={`M${x} ${cy - r}L${x + 4} ${cy + r}`} fill="none" {...fine} />);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={(height * W) / H} height={height} className={className} aria-hidden="true">
      {/* the drill's grip going down, its body, and the chuck that holds the bit */}
      <path d="M14 44L10 64H30L32 44Z" fill={BODY} {...line} />
      <rect x={4} y={24} width={40} height={22} rx={6} fill={BODY} {...line} />
      <path d="M10 30H36M10 35H36M10 40H36" fill="none" {...fine} />
      <path d="M44 27L56 30V42L44 45Z" fill={METAL} {...line} />
      <path d="M48 28V44M52 29V43" fill="none" {...fine} />
      <rect x={56} y={cy - r - 1.2} width={6} height={(r + 1.2) * 2} rx={1} fill={METAL} {...line} />
      {/* the twist bit: a fluted shank to a point */}
      <path d={`M${x0} ${cy - r}H${tipStart}L${tip} ${cy}L${tipStart} ${cy + r}H${x0}Z`} fill={BIT} {...line} />
      {flutes}
      {/* its size, over it */}
      <text x={(x0 + tip) / 2} y={cy - r - 8} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--ink)">
        {bitSize(bit)}
      </text>
    </svg>
  );
}
