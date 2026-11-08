import Link from "next/link";
import { BRAND, BRAND_INFO } from "@/lib/brand";

const HEX = "M16 6.2 L24.5 11.1 L24.5 20.9 L16 25.8 L7.5 20.9 L7.5 11.1 Z";

/** The mark: an Allen bolt head seen from above; in rehber, a terracotta rounded square with a cream square turned in it. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  if (BRAND === "rehber") return <RehberMark size={size} className={className} />;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={"mark " + (className ?? "")} aria-hidden="true">
      <circle cx="16" cy="16" r="15.5" fill="var(--ink)" />
      <path d="M6.2 11.4 A11 11 0 0 1 13 5.6" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.6" strokeLinecap="round" />
      <g className="mark-socket">
        <path d={HEX} fill="var(--accent)" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M16 11.2 L20.2 13.6 L20.2 18.4 L16 20.8 L11.8 18.4 L11.8 13.6 Z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** rehber's mark: the corners rounded by a third of the size, the turned square an outline in the page's cream. */
function RehberMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={"mark " + (className ?? "")} aria-hidden="true">
      <rect width="32" height="32" rx="10.7" fill="var(--accent, #c8643b)" />
      <rect x="11" y="11" width="10" height="10" rx="2.4" fill="none" stroke="var(--page, #f7f1e9)" strokeWidth="3.3" transform="rotate(45 16 16)" />
    </svg>
  );
}

/** The name beside the mark: Bygga's lower case wordmark, or the brand's own name. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={"wordmark " + (className ?? "")}>{BRAND === "rehber" ? BRAND_INFO.name : "bygga"}</span>;
}

export default function Logo({ href = "/", compact, size = 26 }: { href?: string; compact?: boolean; size?: number }) {
  return (
    <Link href={href} className="logo" aria-label="Bygga home">
      <LogoMark size={size} />
      {!compact && <Wordmark />}
    </Link>
  );
}
