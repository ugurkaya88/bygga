import { BRAND } from "@/lib/brand";
import { Figure } from "./Figure";

type Props = React.ComponentProps<typeof Figure>;

/**
 * The little helper on the loading, done, not-found and error screens, the help sheet and the toasts. Bygga shows
 * its builder; rehber has no character, and shows a simple glyph in its own colours instead: a check to cheer, a
 * question mark to think, "!" for trouble, an open box while reading, sparkles for a greeting (the key modal's
 * invitation to the AI features), a small house otherwise.
 */
export function Helper(props: Props) {
  if (BRAND !== "rehber") return <Figure {...props} />;
  return <Glyph {...props} />;
}

type Sign = "check" | "question" | "alert" | "box" | "sparkles" | "house";

/**
 * Each sign drawn on Lucide's 24 grid, like the interface's own icons: its paths, the middle of its drawing on
 * that grid, how much it is scaled up to sit in the disc (about half the disc's width or height), and the point
 * of a "?" or "!", drawn a little heavier than the line so it holds its own beside it.
 */
const SIGNS: Record<Sign, { d: string[]; cx: number; cy: number; k: number; dot?: [number, number] }> = {
  check: { d: ["M20 6 9 17l-5-5"], cx: 12, cy: 11.5, k: 1.3 },
  question: { d: ["M9 9a3 3 0 1 1 5.12 2.12C13.2 12.04 12 12.6 12 14"], cx: 12, cy: 11.6, k: 1.85, dot: [12, 17.6] },
  alert: { d: ["M12 6v8"], cx: 12, cy: 11.8, k: 1.85, dot: [12, 17.6] },
  // an open box: its lid's flaps folded back
  box: {
    d: [
      "M12 22v-9",
      "M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z",
      "M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13",
      "M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z",
    ],
    cx: 12,
    cy: 12,
    k: 1.08,
  },
  // Lucide's sparkles: one large four-pointed star and two small crosses
  sparkles: {
    d: [
      "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
      "M20 3v4",
      "M22 5h-4",
      "M4 17v2",
      "M5 18H3",
    ],
    cx: 12,
    cy: 12,
    k: 1.08,
  },
  house: {
    d: ["M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
    cx: 12,
    cy: 11.75,
    k: 1.08,
  },
};

/** Which sign a pose shows: "!" first, so the error screen's think + "!" shows "!". */
function signOf({ pose = "stand", bubble }: Props): Sign {
  if (bubble === "!") return "alert";
  if (pose === "cheer" || bubble === "check") return "check";
  if (pose === "think" || bubble === "?") return "question";
  if (pose === "read") return "box";
  if (pose === "wave") return "sparkles";
  return "house";
}

/**
 * The line in screen pixels for a disc this wide: 1.8 px up to 40 px (toasts, the help sheet), growing to 2.5 px at
 * 72 px and over (the lost screens), so a large sign does not read faint.
 */
const lineFor = (px: number) => Math.round((1.8 + 0.7 * Math.min(1, Math.max(0, (px - 40) / 32))) * 100) / 100;

/** Rehber's helper: one ink line icon in a soft accent disc, its line a little heavier on the larger discs. */
function Glyph(props: Props) {
  const { size = 80, className } = props;
  const px = Math.round(size * 0.6);
  const line = lineFor(px);
  const { d, cx, cy, k, dot } = SIGNS[signOf(props)];
  return (
    <svg viewBox="0 0 48 48" width={px} height={px} className={"helper " + (className ?? "")} aria-hidden="true">
      <circle cx={24} cy={24} r={24} fill="var(--accent-soft)" />
      <g transform={`translate(24 24) scale(${k}) translate(${-cx} ${-cy})`} fill="none" stroke="var(--ink)" strokeWidth={line} strokeLinecap="round" strokeLinejoin="round">
        {d.map((x) => (
          <path key={x} d={x} vectorEffect="non-scaling-stroke" />
        ))}
        {dot && <path d={`M${dot[0]} ${dot[1]}h.01`} vectorEffect="non-scaling-stroke" strokeWidth={Math.round(line * 1.44 * 100) / 100} />}
      </g>
    </svg>
  );
}
