/**
 * The manuals' countersunk check, as they draw it beside a step: two close-up circles of a board face at a joint,
 * the right one with the hole's wide countersunk mouth (ticked), the wrong one with a plain hole (crossed out).
 */
export function SinkCheck({ width = 92, className }: { width?: number; className?: string }) {
  const line = { stroke: "var(--ink)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const circle = (cx: number, sunk: boolean) => (
    <g>
      <circle cx={cx} cy="31" r="27" fill="#fff" {...line} />
      {/* the joint between the two boards, a little right of the middle */}
      <path d={`M${cx + 9} 5.5V56.5`} fill="none" {...line} />
      {sunk ? (
        <g transform={`rotate(28 ${cx - 6} 30)`}>
          <ellipse cx={cx - 6} cy="30" rx="6.6" ry="9" fill="var(--ink)" />
          <ellipse cx={cx - 4.6} cy="29" rx="3" ry="4.6" fill="#fff" />
        </g>
      ) : (
        <ellipse cx={cx - 6} cy="30" rx="3.6" ry="5.4" transform={`rotate(28 ${cx - 6} 30)`} fill="#fff" {...line} />
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 136 72" width={width} height={(width * 72) / 136} className={className} aria-hidden="true">
      {circle(30, true)}
      {circle(102, false)}
      <path d="M30 58l9 9 16-24" fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 58l9 9 16-24" fill="none" stroke="#1f9d55" strokeWidth={5.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M94 48l18 20M112 48l-18 20" fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" />
      <path d="M94 48l18 20M112 48l-18 20" fill="none" stroke="#c0392b" strokeWidth={5.4} strokeLinecap="round" />
    </svg>
  );
}

/**
 * What the countersunk check is for, as the manuals draw it before step 1: cut through two joined boards, a screw
 * driven in through the countersunk mouth sits flush (ticked); through a plain hole its head stands proud (crossed out).
 */
export function SinkFlush({ width = 150, className }: { width?: number; className?: string }) {
  const line = { stroke: "var(--ink)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const joint = (x: number, sunk: boolean) => {
    const c = x + 30;
    // the top board (cut through), its hole and mouth; the board below that takes the thread
    const top = sunk ? `M${x + 2} 22H${c - 8}L${c - 2.5} 28V40H${x + 2}Z M${c + 8} 22H${x + 58}V40H${c + 2.5}V28Z` : `M${x + 2} 22H${c - 2.5}V40H${x + 2}Z M${c + 2.5} 22H${x + 58}V40H${c + 2.5}Z`;
    const head = sunk ? `M${c - 8} 22H${c + 8}L${c + 2.5} 28H${c - 2.5}Z` : `M${c - 8} 14H${c + 8}L${c + 2.5} 20H${c - 2.5}Z`;
    const y0 = sunk ? 28 : 20;
    let thread = `M${c - 2.2} ${y0}`;
    for (let y = y0 + 3; y <= 60; y += 3) thread += `L${(y - y0) % 6 === 3 ? c + 2.2 : c - 2.2} ${y}`;
    return (
      <g>
        <path d={top} fill="#fff" {...line} />
        <path d={`M${x + 2} 40H${x + 58}V64H${x + 2}Z`} fill="#f1efe9" {...line} />
        <path d={thread} fill="none" {...line} strokeWidth={1.2} />
        <path d={head} fill="#b9b7b0" {...line} />
        {!sunk && <path d={`M${c + 12} 14V22M${c + 9.5} 16.5l2.5-2.5 2.5 2.5M${c + 9.5} 19.5l2.5 2.5 2.5-2.5`} fill="none" {...line} stroke="#c0392b" strokeWidth={1.4} />}
      </g>
    );
  };
  return (
    <svg viewBox="0 0 150 88" width={width} height={(width * 88) / 150} className={className} aria-hidden="true">
      {joint(4, true)}
      {joint(84, false)}
      <path d="M26 72l7 7 13-19" fill="none" stroke="#1f9d55" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M106 64l15 17M121 64l-15 17" fill="none" stroke="#c0392b" strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}
