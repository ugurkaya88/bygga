import { BRAND } from "@/lib/brand";
import { Figure } from "./Figure";

type Props = React.ComponentProps<typeof Figure>;

/**
 * The little helper on the loading, done, not-found and error screens, the help sheet and the toasts. Bygga shows
 * its builder; rehber has no character, and shows a simple glyph in its own colours instead: a check to cheer, a
 * question mark to think, "!" for trouble, an open box while reading, a small house otherwise.
 */
export function Helper(props: Props) {
  if (BRAND !== "rehber") return <Figure {...props} />;
  return <Glyph {...props} />;
}

type Sign = "check" | "question" | "alert" | "box" | "house";

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
  return "house";
}

/** Rehber's helper: one ink line icon, 1.8 px at every size, in a soft accent disc. */
function Glyph(props: Props) {
  const { size = 80, className } = props;
  const px = Math.round(size * 0.6);
  const { d, cx, cy, k, dot } = SIGNS[signOf(props)];
  return (
    <svg viewBox="0 0 48 48" width={px} height={px} className={"helper " + (className ?? "")} aria-hidden="true">
      <circle cx={24} cy={24} r={24} fill="var(--accent-soft)" />
      <g transform={`translate(24 24) scale(${k}) translate(${-cx} ${-cy})`} fill="none" stroke="var(--ink)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {d.map((x) => (
          <path key={x} d={x} vectorEffect="non-scaling-stroke" />
        ))}
        {dot && <path d={`M${dot[0]} ${dot[1]}h.01`} vectorEffect="non-scaling-stroke" strokeWidth={2.6} />}
      </g>
    </svg>
  );
}
