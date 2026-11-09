import type { HwType, Plan } from "@/lib/types";

// Fills come from the theme (rehber/art.css); with no brand each falls back to Bygga's own colour.
const SCREW = "var(--art-metal, #e3e5e7)";
/** the ground around the drawing, as a halo that keeps the tick and the cross off the screws' lines */
const HALO = "var(--art-paper, #fff)";
/** the tick and the cross: a clear green and a clear red in every theme */
const OK = "var(--art-ok, #1f9d55)";
const WRONG = "var(--art-wrong, #c0392b)";

/** viewBox units per mm */
const K = 2;
const COL = 48;
const TOP = 4;
const LABEL = 19;

export interface CheckScrew {
  len: number;
  dia: number;
  ok: boolean;
}

/**
 * The screws a step's length check shows, as the manuals draw it: every screw size in the box, shortest first,
 * the ones this step uses ticked. Empty when the step uses none of them.
 */
export function checkScrews(plan: Plan, used: HwType[]): CheckScrew[] {
  const sizes = new Map<string, CheckScrew>();
  for (const h of plan.hardware) {
    if (h.kind !== "screw" || h.notIncluded) continue;
    const key = `${h.dia}x${h.len}`;
    const ok = used.some((u) => u.kind === "screw" && u.dia === h.dia && u.len === h.len);
    const had = sizes.get(key);
    sizes.set(key, { len: h.len, dia: h.dia, ok: ok || (had?.ok ?? false) });
  }
  const list = [...sizes.values()].sort((a, b) => a.len - b.len || a.dia - b.dia).slice(0, 5);
  return list.some((s) => s.ok) && list.length > 1 ? list : [];
}

/** A screw standing on its point, countersunk head up, `len` mm from the head's face to the point. */
function screw(cx: number, len: number, dia: number) {
  const r = (dia / 2) * K;
  const hr = Math.max(dia * 1.05, 3.4) * K;
  const top = TOP;
  const rim = top + 0.5 * K;
  const neck = rim + hr - r * 0.9;
  const tipAt = top + len * K;
  const tipStart = tipAt - Math.max(2.2, dia * 0.8) * K;
  const ticks = [];
  for (let y = neck + 2.2 * K; y < tipStart - 1; y += 1.7 * K) ticks.push(<path key={y} d={`M${cx - r * 0.9} ${y} L${cx + r * 0.9} ${y + 0.9 * K}`} fill="none" stroke="var(--ink)" strokeWidth={0.9} opacity={0.55} />);
  const line = { stroke: "var(--ink)", strokeWidth: 1.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;
  return (
    <g>
      <path d={`M${cx - r * 0.9} ${neck - 0.5} V${tipStart} L${cx} ${tipAt} L${cx + r * 0.9} ${tipStart} V${neck - 0.5} Z`} fill={SCREW} {...line} />
      {ticks}
      <path d={`M${cx - hr} ${top} H${cx + hr} V${rim} L${cx + r * 0.9} ${neck} H${cx - r * 0.9} L${cx - hr} ${rim} Z`} fill={SCREW} {...line} />
    </g>
  );
}

/**
 * The manuals' screw length check beside a step: the box's screws side by side at their real proportions, heads
 * level, each with its size under it; the ones to use in this step ticked, the others crossed out in red.
 */
export function ScrewCheck({ screws, height = 110, className }: { screws: CheckScrew[]; height?: number; className?: string }) {
  if (!screws.length) return null;
  const maxLen = Math.max(...screws.map((s) => s.len));
  const w = screws.length * COL;
  const h = TOP + maxLen * K + 4 + LABEL;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={(height * w) / h} height={height} className={className} aria-hidden="true">
      {screws.map((s, i) => {
        const cx = i * COL + COL / 2;
        const mid = TOP + (s.len * K) / 2;
        const x = Math.min(12, COL / 2 - 4);
        const y = Math.min(16, (s.len * K) / 2 + 4);
        return (
          <g key={`${s.dia}x${s.len}`}>
            {screw(cx, s.len, s.dia)}
            {s.ok ? (
              <>
                <path d={`M${cx + 4} ${mid}l5 5 10-13`} fill="none" stroke={HALO} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
                <path d={`M${cx + 4} ${mid}l5 5 10-13`} fill="none" stroke={OK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <>
                <path d={`M${cx - x} ${mid - y}L${cx + x} ${mid + y}M${cx + x} ${mid - y}L${cx - x} ${mid + y}`} fill="none" stroke={HALO} strokeWidth={6.5} strokeLinecap="round" />
                <path d={`M${cx - x} ${mid - y}L${cx + x} ${mid + y}M${cx + x} ${mid - y}L${cx - x} ${mid + y}`} fill="none" stroke={WRONG} strokeWidth={3.6} strokeLinecap="round" />
              </>
            )}
            <text x={cx} y={h - 4} textAnchor="middle" fontSize={12.5} fontWeight={s.ok ? 800 : 600} fill={s.ok ? "var(--ink)" : "var(--ink-2)"}>
              {`${s.dia}×${s.len}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
