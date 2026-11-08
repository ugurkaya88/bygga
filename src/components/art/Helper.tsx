import { BRAND } from "@/lib/brand";
import { Figure } from "./Figure";

/**
 * The little helper on the loading, done, not-found and error screens, the help sheet and the toasts. Bygga shows
 * its builder; rehber has no character, and shows a simple glyph in its own colours instead: a check to cheer, a
 * question mark to think, "!" for trouble, a parcel while reading, a house otherwise.
 */
export function Helper(props: React.ComponentProps<typeof Figure>) {
  if (BRAND !== "rehber") return <Figure {...props} />;
  return <Glyph {...props} />;
}

/** A placeholder for rehber's own icons: a soft accent disc with one stroked sign in it. */
function Glyph({ pose = "stand", size = 80, className, bubble }: React.ComponentProps<typeof Figure>) {
  const px = Math.round(size * 0.6);
  const ink = { fill: "none", stroke: "var(--accent-text, #a64b26)", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const dot = <circle cx={24} cy={33.5} r={2} fill="var(--accent-text, #a64b26)" />;
  let sign: React.ReactNode;
  if (bubble === "!")
    sign = (
      <>
        <path d="M24 14 V27" {...ink} />
        {dot}
      </>
    );
  else if (pose === "cheer" || bubble === "check") sign = <path d="M15 24.5 L21 30.5 L33.5 17.5" {...ink} />;
  else if (pose === "think" || bubble === "?")
    sign = (
      <>
        <path d="M18.5 19 A5.6 5.6 0 1 1 26.7 23.9 C25 24.9 24 26 24 27.6 V28.4" {...ink} />
        {dot}
      </>
    );
  else if (pose === "read")
    sign = (
      <>
        <rect x={14} y={17} width={20} height={16} rx={2.5} {...ink} />
        <path d="M14 22.5 H34 M21 17 V27 H27 V17" {...ink} />
      </>
    );
  else sign = <path d="M14.5 23.5 L24 15.5 L33.5 23.5 V33 H14.5 Z M21 33 V27 H27 V33" {...ink} />;
  return (
    <svg viewBox="0 0 48 48" width={px} height={px} className={"helper " + (className ?? "")} aria-hidden="true">
      <circle cx={24} cy={24} r={24} fill="var(--accent-soft, #fbe9dc)" />
      {sign}
    </svg>
  );
}
