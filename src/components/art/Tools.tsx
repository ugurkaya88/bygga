import type { ToolId } from "@/lib/types";
import { t } from "@/lib/i18n";

const S = { stroke: "var(--ink)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
// Fills come from the theme (rehber/art.css); with no brand each falls back to Bygga's own colour.
/** the white body of a tool */
const W = "var(--art-paper, #fff)";
/** its metal and grip parts */
const G = "var(--art-tool-metal, #ecebe6)";
const A = "var(--accent-soft)";

/** Hand drawn tool illustrations in the same line style as the 3D stage. viewBox 0 0 96 96; strokes are in screen pixels, so lines weigh the same at any size. */
export function ToolArt({ id, size = 96, className }: { id: ToolId; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={"line-art " + (className ?? "")} aria-hidden="true">
      {ART[id]}
    </svg>
  );
}

const ART: Record<ToolId, React.ReactNode> = {
  allen: (
    <g transform="rotate(-28 48 48)" {...S}>
      <path d="M40 10 h10 v58 a4 4 0 0 0 4 4 h24 v10 h-30 a8 8 0 0 1 -8 -8 z" fill={W} />
      <path d="M40 18 h10 M70 72 v10" fill="none" />
      <path d="M45 10 v58" fill="none" strokeWidth={1.2} opacity={0.5} />
      <path d="M50 76 h28" fill="none" strokeWidth={1.2} opacity={0.5} />
    </g>
  ),
  screwdriver: (
    <g transform="rotate(38 48 48)" {...S}>
      <rect x="38" y="6" width="20" height="38" rx="8" fill={W} />
      <path d="M44 13 v24 M48 12 v26 M52 13 v24" fill="none" strokeWidth={1.4} />
      <rect x="42" y="44" width="12" height="6" rx="2" fill={G} />
      <rect x="45.5" y="50" width="5" height="32" fill={W} />
      <path d="M45.5 82 L48 90 L50.5 82 Z" fill={G} />
      <path d="M48 83.5 v4.5 M46.6 85.6 h2.8" fill="none" strokeWidth={1.1} />
    </g>
  ),
  flathead: (
    <g transform="rotate(38 48 48)" {...S}>
      <rect x="38" y="6" width="20" height="38" rx="8" fill={W} />
      <path d="M44 13 v24 M48 12 v26 M52 13 v24" fill="none" strokeWidth={1.4} />
      <rect x="42" y="44" width="12" height="6" rx="2" fill={G} />
      <rect x="45.5" y="50" width="5" height="32" fill={W} />
      <path d="M45.5 82 L44.5 90 h7 L50.5 82 Z" fill={G} />
    </g>
  ),
  hammer: (
    <g transform="rotate(-32 48 48)" {...S}>
      <rect x="43" y="30" width="10" height="58" rx="4" fill={W} />
      <rect x="43" y="62" width="10" height="26" rx="4" fill={G} />
      <path d="M30 16 h36 a3 3 0 0 1 3 3 v12 a3 3 0 0 1 -3 3 h-36 z" fill={W} />
      <rect x="66" y="13" width="9" height="24" rx="2.5" fill={G} />
      <path d="M30 17 C20 16 14 22 11 30 C16 27 21 26 30 27 M30 33 C24 33 19 35 16 40" fill={W} />
    </g>
  ),
  drill: (
    <g {...S}>
      <path d="M36 50 L30 76 h18 L52 50 Z" fill={W} />
      <rect x="26" y="76" width="28" height="12" rx="3" fill={G} />
      <rect x="14" y="26" width="52" height="24" rx="12" fill={W} />
      <path d="M24 30 v16" fill="none" strokeWidth={1.4} />
      <path d="M28 30 v16" fill="none" strokeWidth={1.4} />
      <rect x="66" y="30" width="10" height="16" rx="3" fill={G} />
      <path d="M76 38 h14" fill="none" strokeWidth={2} />
      <path d="M79 35.5 l2 5 M83 35.5 l2 5 M87 35.5 l2 5" fill="none" strokeWidth={1.1} />
      <rect x="40" y="50" width="6" height="8" rx="2" fill={A} />
    </g>
  ),
  level: (
    <g transform="rotate(-14 48 48)" {...S}>
      <rect x="6" y="38" width="84" height="20" rx="3" fill={W} />
      <rect x="37" y="42" width="22" height="12" rx="6" fill={A} />
      <circle cx="48" cy="48" r="3.4" fill={W} />
      <path d="M44 42 v12 M52 42 v12" fill="none" strokeWidth={1.2} />
      <path d="M14 38 v6 M22 38 v4 M30 38 v6 M66 38 v6 M74 38 v4 M82 38 v6" fill="none" strokeWidth={1.3} />
    </g>
  ),
  tape: (
    <g {...S}>
      <path d="M54 58 h34 v10 h-34" fill={A} />
      <path d="M60 58 v4 M66 58 v6 M72 58 v4 M78 58 v6 M84 58 v4" fill="none" strokeWidth={1.2} />
      <path d="M88 56 v14" fill="none" strokeWidth={2.6} />
      <rect x="10" y="26" width="48" height="46" rx="14" fill={W} />
      <circle cx="34" cy="49" r="12" fill={G} />
      <circle cx="34" cy="49" r="4" fill={W} />
      <rect x="40" y="20" width="12" height="8" rx="2" fill={G} />
    </g>
  ),
  pencil: (
    <g transform="rotate(-40 48 48)" {...S}>
      <rect x="40" y="10" width="16" height="10" rx="3" fill={G} />
      <rect x="40" y="20" width="16" height="50" fill={W} />
      <path d="M45.3 20 v50 M50.6 20 v50" fill="none" strokeWidth={1.1} />
      <path d="M40 70 L48 88 L56 70 Z" fill={A} />
      <path d="M45.2 82 L48 88 L50.8 82 Z" fill="var(--ink)" />
    </g>
  ),
  wrench: (
    <g transform="rotate(-38 48 48)" {...S}>
      <rect x="34" y="42" width="54" height="12" rx="6" fill={W} />
      <circle cx="24" cy="48" r="16" fill={W} />
      <path d="M8 42 h12 l3 6 l-3 6 h-12" fill="var(--paper)" />
      <path d="M8.6 42.4 v11.2" stroke="var(--paper)" strokeWidth={3} />
      <circle cx="80" cy="48" r="2.6" fill={G} />
    </g>
  ),
  knife: (
    <g transform="rotate(-24 48 48)" {...S}>
      <path d="M14 42 h52 a8 8 0 0 1 8 8 v2 a8 8 0 0 1 -8 8 h-52 z" fill={W} />
      <path d="M74 44 L90 50 L74 56 Z" fill={G} />
      <path d="M24 46 h22" fill="none" strokeWidth={1.3} />
      <rect x="50" y="38" width="10" height="5" rx="2" fill={A} />
    </g>
  ),
};

const info = (id: ToolId) => ({
  name: t(`tool.${id}.name`),
  hint: t(`tool.${id}.hint`),
  alt: t(`tool.${id}.alt`),
  short: t(`tool.${id}.short`),
});

export const TOOL_INFO: Record<ToolId, { name: string; hint: string; alt?: string; short?: string }> = {
  allen: info("allen"),
  screwdriver: info("screwdriver"),
  flathead: info("flathead"),
  hammer: info("hammer"),
  drill: info("drill"),
  level: info("level"),
  tape: info("tape"),
  pencil: info("pencil"),
  wrench: info("wrench"),
  knife: info("knife"),
};
