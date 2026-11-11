import { t } from "@/lib/i18n";

// Fills come from the theme (rehber/art.css); with no brand each falls back to Bygga's own colour.
/** the door, cut through or seen edge on */
const DOOR = "var(--art-board, #fff)";
/** the body's side panel the hinge is fixed to */
const SIDE = "var(--art-board-2, #f1efe9)";
const METAL = "var(--art-metal, #e3e5e7)";
/** the screw being turned */
const TURN = "var(--accent)";

/** The three adjusting screws of a cup hinge, in the order the manuals give them. */
export const ADJUSTS = ["side", "depth", "height"] as const;
export type Adjust = (typeof ADJUSTS)[number];

const line = { stroke: "var(--ink)", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** Three quarters of a turn clockwise round (cx, cy), with a filled head: the screw being turned. */
function turnArrow(cx: number, cy: number) {
  const r = 7, a0 = (150 * Math.PI) / 180, a1 = (60 * Math.PI) / 180;
  const p = (a: number, k = r): [number, number] => [cx + k * Math.cos(a), cy + k * Math.sin(a)];
  const [sx, sy] = p(a0), [ex, ey] = p(a1);
  // along the turn at its end, and out from the middle
  const tx = -Math.sin(a1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
  const f = (v: number) => v.toFixed(2);
  const head = `M${f(ex + tx * 2.6)} ${f(ey + ty * 2.6)}L${f(ex - tx * 1.2 + nx * 2)} ${f(ey - ty * 1.2 + ny * 2)}L${f(ex - tx * 1.2 - nx * 2)} ${f(ey - ty * 1.2 - ny * 2)}Z`;
  return (
    <g>
      {/* a halo of paper keeps the turn clear of the arm's outline under it */}
      <path d={`M${f(sx)} ${f(sy)}A${r} ${r} 0 1 1 ${f(ex)} ${f(ey)}`} fill="none" stroke="var(--art-paper, #fff)" strokeWidth={3.4} strokeLinecap="round" />
      <path d={head} fill="var(--art-paper, #fff)" stroke="var(--art-paper, #fff)" strokeWidth={2.4} strokeLinejoin="round" />
      <path d={`M${f(sx)} ${f(sy)}A${r} ${r} 0 1 1 ${f(ex)} ${f(ey)}`} fill="none" {...line} strokeWidth={1.4} />
      <path d={head} fill="var(--ink)" {...line} strokeWidth={0.8} />
    </g>
  );
}

/** A cross-head screw seen from above, filled when it is the one turned, with a curved arrow round it. */
function screw(cx: number, cy: number, on: boolean) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={2.9} fill={on ? TURN : METAL} {...line} strokeWidth={1.2} />
      <path d={`M${cx - 1.6} ${cy}H${cx + 1.6}M${cx} ${cy - 1.6}V${cy + 1.6}`} fill="none" {...line} strokeWidth={1} />
      {on && turnArrow(cx, cy)}
    </g>
  );
}

/** A two-headed arrow from (x1, y1) to (x2, y2): the way the door moves. */
function arrow(x1: number, y1: number, x2: number, y2: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (x: number, y: number, ang: number) => {
    const l = 4.2, w = 0.62;
    return `M${x - l * Math.cos(ang - w)} ${y - l * Math.sin(ang - w)}L${x} ${y}L${x - l * Math.cos(ang + w)} ${y - l * Math.sin(ang + w)}`;
  };
  return (
    <g fill="none" {...line} strokeWidth={1.8}>
      <path d={`M${x1} ${y1}L${x2} ${y2}`} />
      <path d={head(x2, y2, a)} />
      <path d={head(x1, y1, a + Math.PI)} />
    </g>
  );
}

/**
 * The hinge seen from above: the body's side panel cut through on the left, the door across the front, the hinge's
 * plate on the side panel and its arm reaching round to the cup in the door. The arm's front screw moves the door
 * sideways, its back screw moves it toward or away from the body.
 */
function fromAbove(turn: "side" | "depth") {
  return (
    <>
      <rect x={4} y={4} width={9} height={37} fill={SIDE} {...line} />
      <rect x={4} y={43} width={50} height={9} fill={DOOR} {...line} />
      {/* the cup, sunk into the back of the door */}
      <path d="M33 43V47.5A6.5 3 0 0 0 46 47.5V43Z" fill={METAL} {...line} strokeWidth={1.2} />
      <rect x={13} y={13} width={4} height={17} rx={1} fill={METAL} {...line} strokeWidth={1.2} />
      {/* the arm, out from the plate and round to the cup */}
      <path d="M17 16.5H39Q44.5 16.5 44.5 22V43H35V28Q35 25.5 32.5 25.5H17Z" fill={METAL} {...line} />
      {screw(23, 21, turn === "depth")}
      {screw(39.5, 30, turn === "side")}
      {turn === "side" ? arrow(10, 57, 50, 57) : arrow(63, 30, 63, 54)}
    </>
  );
}

/**
 * The hinge seen from inside the body: the side panel's inner face, the door edge on at the right, the mounting
 * plate on the panel with the arm over it. The plate's screw moves the door up or down.
 */
function fromInside() {
  return (
    <>
      <rect x={4} y={4} width={44} height={52} fill={SIDE} {...line} />
      <rect x={50} y={2} width={8} height={56} fill={DOOR} {...line} />
      <rect x={13} y={13} width={13} height={34} rx={3} fill={METAL} {...line} strokeWidth={1.2} />
      <rect x={17} y={25} width={33} height={10} rx={2} fill={METAL} {...line} />
      {screw(19.5, 18.5, true)}
      {screw(19.5, 41.5, false)}
      {arrow(65, 14, 65, 46)}
    </>
  );
}

/** One adjustment drawn: what moves the door which way. viewBox 72 by 60. */
export function HingeAdjustArt({ which, width = 72, className }: { which: Adjust; width?: number; className?: string }) {
  return (
    <svg viewBox="0 0 72 60" width={width} height={(width * 60) / 72} className={className} aria-hidden="true">
      {which === "height" ? fromInside() : fromAbove(which)}
    </svg>
  );
}

/** The short name of each adjustment, for the card over the drawing. */
export const adjustLabel = (a: Adjust) => t(a === "side" ? "warn.adjustSide" : a === "depth" ? "warn.adjustDepth" : "warn.adjustHeight");
/** What each adjustment does, for the step's own card. */
export const adjustBody = (a: Adjust) => t(a === "side" ? "warn.adjustSideBody" : a === "depth" ? "warn.adjustDepthBody" : "warn.adjustHeightBody");

/** The three adjustments side by side, each with its short name under it: the card over the step's drawing. */
export function HingeAdjust({ width = 64, className }: { width?: number; className?: string }) {
  return (
    <div className={"adjust-row " + (className ?? "")}>
      {ADJUSTS.map((a) => (
        <figure key={a} className="adjust-one">
          <HingeAdjustArt which={a} width={width} />
          <figcaption>{adjustLabel(a)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
