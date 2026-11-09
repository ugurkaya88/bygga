import type { HwKind } from "@/lib/types";

// Fills come from the theme (rehber/art.css); with no brand each falls back to Bygga's own colour.
const METAL = "var(--art-metal, #e3e5e7)";
/** a lighter face of metal: the turned-up side of a bracket, a hinge's cup, the top of a cam */
const METAL_LIT = "var(--art-metal-lit, #eef0f1)";
const METAL_TOP = "var(--art-metal-lit, #f2f3f4)";
const WOOD = "var(--art-wood, #f1e2c3)";
const PLASTIC = "var(--art-plastic, #f4f4f1)";
/** holes seen through, and the light ribs of a glide */
const PAPER = "var(--art-paper, #fff)";

interface Drawn {
  w: number;
  h: number;
  node: React.ReactNode;
  scalable: boolean;
}

const stroke = { stroke: "var(--ink)", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const fine = { stroke: "var(--ink)", strokeWidth: 0.9, vectorEffect: "non-scaling-stroke", opacity: 0.55, strokeLinecap: "round" } as const;
/** the lines inside a busy drawing (a hole, a slot, a step in the metal): full ink, a little thinner than its outline */
const inner = { ...stroke, strokeWidth: 1 } as const;

function thread(x0: number, x1: number, r: number, pitch: number) {
  let d = `M${x0} ${-r}`;
  let up = true;
  for (let x = x0 + pitch / 2; x <= x1 + 0.01; x += pitch / 2) {
    d += ` L${Math.min(x, x1)} ${up ? -r * 0.78 : -r}`;
    up = !up;
  }
  d += ` L${x1} ${r}`;
  up = true;
  for (let x = x1 - pitch / 2; x >= x0 - 0.01; x -= pitch / 2) {
    d += ` L${Math.max(x, x0)} ${up ? r * 0.78 : r}`;
    up = !up;
  }
  return d + " Z";
}

/* Isometric drawing, as the manuals draw a cup hinge and its plate: x runs right and down, z left and down, y up, in mm. */
type P3 = [number, number, number];
type P2 = [number, number];
const iso = ([x, y, z]: P3): P2 => [(x - z) * 0.866, (x + z) * 0.5 - y];
const path2 = (pts: P2[]) => pts.map(([u, v], i) => `${i ? "L" : "M"}${u.toFixed(2)} ${v.toFixed(2)}`).join(" ") + " Z";
const isoPath = (pts: P3[]) => path2(pts.map(iso));
const deg = (a: number) => (a * Math.PI) / 180;

/** Points round a rounded rectangle lying flat at height y, x from x0 to x1 and z from z0 to z1, corner by corner. */
function flatRect(x0: number, z0: number, x1: number, z1: number, r: number, y: number): P3[] {
  const out: P3[] = [];
  const corners: P3[] = [
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, 90],
    [x0 + r, z0 + r, 180],
    [x1 - r, z0 + r, 270],
  ];
  for (const [cx, cz, a0] of corners) for (let k = 0; k <= 4; k++) out.push([cx + r * Math.cos(deg(a0 + k * 22.5)), y, cz + r * Math.sin(deg(a0 + k * 22.5))]);
  return out;
}

/** Points round a slot lying flat at height y: half circles of radius r, `half` either side of (cx, cz) along z. */
function flatSlot(cx: number, cz: number, half: number, r: number, y: number): P3[] {
  const out: P3[] = [];
  for (const [zc, a0] of [
    [cz + half, 0],
    [cz - half, 180],
  ])
    for (let k = 0; k <= 8; k++) out.push([cx + r * Math.cos(deg(a0 + k * 22.5)), y, zc + r * Math.sin(deg(a0 + k * 22.5))]);
  return out;
}

/** A flat circle's isometric ellipse. */
const isoEllipse = (x: number, y: number, z: number, r: number) => {
  const [cx, cy] = iso([x, y, z]);
  return { cx, cy, rx: r * 1.2247, ry: r * 0.7071 };
};

/** A plate lying flat, `t` mm thick: its top face over the band of edge that shows below it (the outline convex on its near side). */
function IsoSlab({ top, t }: { top: P3[]; t: number }) {
  const q = top.map(iso);
  let l = 0,
    r = 0;
  q.forEach(([u], i) => {
    if (u < q[l][0]) l = i;
    if (u > q[r][0]) r = i;
  });
  const chain = (step: number) => {
    const c: P2[] = [];
    for (let i = l; ; i = (i + step + q.length) % q.length) {
      c.push(q[i]);
      if (i === r) break;
    }
    return c;
  };
  const mean = (c: P2[]) => c.reduce((s, p) => s + p[1], 0) / c.length;
  const [a, b] = [chain(1), chain(-1)];
  const low = mean(a) > mean(b) ? a : b;
  return (
    <>
      <path d={path2([...low.map(([u, v]): P2 => [u, v + t]), ...low.slice().reverse()])} fill={METAL} {...stroke} />
      <path d={path2(q)} fill={METAL_LIT} {...stroke} />
    </>
  );
}

/** A cylinder standing up from y0 to y1 at (x, z): its side, then its top. */
function IsoCyl({ x, z, r, y0, y1, top = METAL_LIT }: { x: number; z: number; r: number; y0: number; y1: number; top?: string }) {
  const a = isoEllipse(x, y1, z, r),
    b = isoEllipse(x, y0, z, r);
  return (
    <>
      <path d={`M${a.cx - a.rx} ${a.cy} L${b.cx - b.rx} ${b.cy} A${b.rx} ${b.ry} 0 0 0 ${b.cx + b.rx} ${b.cy} L${a.cx + a.rx} ${a.cy} Z`} fill={METAL} {...stroke} />
      <ellipse {...a} fill={top} {...stroke} />
    </>
  );
}

/** A pan-head screw standing on y at (x, z): the head with its cross. */
function IsoPanHead({ x, y, z, r, h }: { x: number; y: number; z: number; r: number; h: number }) {
  const k = r * 0.55;
  return (
    <>
      <IsoCyl x={x} z={z} r={r} y0={y} y1={y + h} />
      <path d={`${isoPath([[x - k, y + h, z], [x + k, y + h, z]])} ${isoPath([[x, y + h, z - k], [x, y + h, z + k]])}`} {...inner} />
    </>
  );
}

/** The box an isometric drawing takes, from points round its outline: Drawn's w and h, and the shift that centres it. */
function isoFit(pts: P3[]) {
  const q = pts.map(iso);
  const u0 = Math.min(...q.map((p) => p[0])),
    u1 = Math.max(...q.map((p) => p[0]));
  const v0 = Math.min(...q.map((p) => p[1])),
    v1 = Math.max(...q.map((p) => p[1]));
  return { w: u1 - u0, h: v1 - v0, at: `translate(${(-u0).toFixed(2)} ${(-(v0 + v1) / 2).toFixed(2)})` };
}

function draw(kind: HwKind, len: number, dia: number): Drawn {
  const r = dia / 2;
  switch (kind) {
    case "dowel": {
      const lines = [-r / 2, 0, r / 2].map((y) => <path key={y} d={`M${dia * 0.45} ${y} H${len - dia * 0.45}`} {...fine} />);
      return { w: len, h: dia, scalable: true, node: <g><rect x={0} y={-r} width={len} height={dia} rx={r * 0.55} fill={WOOD} {...stroke} />{lines}</g> };
    }
    case "camScrew":
      return {
        w: 35,
        h: 8,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, 11, 2.9, 1.4)} fill={METAL} {...stroke} />
            <rect x={11} y={-3.8} width={1.6} height={7.6} rx={0.6} fill={METAL} {...stroke} />
            <rect x={12.6} y={-2.2} width={15.6} height={4.4} fill={METAL} {...stroke} />
            <circle cx={31.4} cy={0} r={3.6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "cam":
      return {
        w: 15,
        h: 16,
        scalable: true,
        node: (
          <g transform="translate(0 -4)">
            <path d="M0 0 V9.5 A7.5 3.2 0 0 0 15 9.5 V0" fill={METAL} {...stroke} />
            <ellipse cx={7.5} cy={0} rx={7.5} ry={3.2} fill={METAL_TOP} {...stroke} />
            <path d="M3.4 -1.1 L11.6 1.1" {...stroke} strokeWidth={2.2} />
            <path d="M10.6 -1.9 L13 -0.6 L11.2 0.6" fill="none" {...stroke} strokeWidth={1.1} />
          </g>
        ),
      };
    case "screw": {
      // a countersunk chipboard screw, as the manuals draw it: a flat head with a thin rim, then a cone down to
      // the shank; `len` runs from the head's face to the point
      const hr = Math.max(dia * 1.05, 3.4);
      const neck = 0.5 + hr - r * 0.9;
      const ticks = [];
      for (let x = neck + 1.4; x < len - 3; x += 1.7) ticks.push(<path key={x} d={`M${x} ${-r * 0.9} L${x + 0.9} ${r * 0.9}`} {...fine} />);
      return {
        w: len + 2,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <path d={`M${neck - 0.3} ${-r * 0.9} H${len - 1.5} L${len + 1.6} 0 L${len - 1.5} ${r * 0.9} H${neck - 0.3} Z`} fill={METAL} {...stroke} />
            {ticks}
            <path d={`M0 ${-hr} H0.5 L${neck} ${-r * 0.9} V${r * 0.9} L0.5 ${hr} H0 Z`} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "nail":
      return {
        w: len,
        h: dia * 3.4,
        scalable: true,
        node: (
          <g>
            <path d={`M0.8 ${-r} H${len - 1.8} L${len} 0 L${len - 1.8} ${r} H0.8 Z`} fill={METAL} {...stroke} />
            <rect x={0} y={-dia * 1.7} width={0.9} height={dia * 3.4} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "pin":
      return {
        w: 17.4,
        h: dia + 2.4,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-r} width={8.4} height={dia} rx={0.8} fill={METAL} {...stroke} />
            <rect x={9.6} y={-r} width={7.8} height={dia} rx={r * 0.8} fill={METAL} {...stroke} />
            <rect x={8.2} y={-r - 1.2} width={1.6} height={dia + 2.4} rx={0.6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "legScrew": {
      const mid = 12;
      const a = (len - mid) / 2;
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, a, r, 1.6)} fill={METAL} {...stroke} />
            <rect x={a} y={-r * 0.82} width={mid} height={r * 1.64} fill={METAL} {...stroke} />
            <path d={thread(a + mid, len, r, 1.6)} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "bolt": {
      const hr = dia * 0.85;
      const t0 = 5 + len * 0.45;
      return {
        w: len + 5,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <rect x={5} y={-r} width={t0 - 5} height={dia} fill={METAL} {...stroke} />
            <path d={thread(t0, len + 5, r, 1.2)} fill={METAL} {...stroke} />
            <rect x={0} y={-hr} width={5.2} height={hr * 2} rx={1} fill={METAL} {...stroke} />
            <path d={`M1.4 ${-hr * 0.42} H3.6 M1.4 ${hr * 0.42} H3.6`} {...fine} />
          </g>
        ),
      };
    }
    case "plate":
      return {
        w: 70,
        h: 70,
        scalable: true,
        node: (
          <g transform="translate(0 -35)">
            <rect x={0} y={0} width={70} height={70} rx={4} fill={METAL} {...stroke} />
            {[
              [7, 7],
              [63, 7],
              [63, 63],
              [7, 63],
            ].map(([x, y]) => (
              <circle key={x + "-" + y} cx={x} cy={y} r={2.6} fill={PAPER} {...stroke} />
            ))}
            <circle cx={35} cy={35} r={10} fill={METAL_LIT} {...stroke} />
            <circle cx={35} cy={35} r={4.6} fill={PAPER} {...stroke} />
          </g>
        ),
      };
    case "bracket":
      return {
        w: 46,
        h: 46,
        scalable: true,
        node: (
          <g transform="translate(0 -23)">
            <path d="M6 30 L30 44 L46 34 L22 20 Z" fill={METAL} {...stroke} />
            <path d="M22 20 L22 2 L46 16 L46 34 Z" fill={METAL_LIT} {...stroke} />
            <ellipse cx={34} cy={18} rx={2.6} ry={3.2} fill={PAPER} {...stroke} />
            <ellipse cx={21} cy={31} rx={3} ry={1.8} fill={PAPER} {...stroke} />
            <ellipse cx={31} cy={37} rx={3} ry={1.8} fill={PAPER} {...stroke} />
          </g>
        ),
      };
    case "runner":
      return {
        w: 120,
        h: 22,
        scalable: false,
        node: (
          <g>
            <path d="M0 -6 H114 L120 0 L114 6 H0 Z" fill={METAL} {...stroke} />
            <path d="M0 -10 H112 V-6 H0 Z" fill={METAL_LIT} {...stroke} />
            {[16, 60, 104].map((x) => (
              <circle key={x} cx={x} cy={0} r={2} fill={PAPER} {...stroke} />
            ))}
          </g>
        ),
      };
    case "knob":
      return {
        w: 26,
        h: 30,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-5.5} width={12} height={11} rx={1.5} fill={WOOD} {...stroke} />
            <path d="M12 -14 C22 -14 26 -8 26 0 C26 8 22 14 12 14 C10.5 14 10.5 -14 12 -14 Z" fill={WOOD} {...stroke} />
          </g>
        ),
      };
    case "handle":
      return {
        w: len + 24,
        h: 34,
        scalable: true,
        node: (
          <g transform="translate(0 -6)">
            <rect x={12 - 4} y={-8} width={8} height={26} rx={3} fill={METAL} {...stroke} transform={`translate(0 0)`} />
            <rect x={len + 12 - 4} y={-8} width={8} height={26} rx={3} fill={METAL} {...stroke} />
            <rect x={0} y={-14} width={len + 24} height={12} rx={6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "hinge": {
      // a cup hinge as the manuals draw it (A12), opened out, at real size whatever len and dia say: the 35 mm cup
      // with its rim, the screw flange across it with a countersunk hole 24 mm either side and a window for the
      // knuckle, and the arm lying back from the cup with its adjusting screw and the keyhole for the plate's screw
      const flange = flatRect(-31, 0, 31, 15, 5, 2.5);
      flange.splice(15, 0, [-9, 2.5, 0], [-9, 2.5, 6], [9, 2.5, 6], [9, 2.5, 0]);
      // the keyhole: a slot for the screw's shank opening into a round hole its head goes through
      const j = Math.sqrt(4.4 ** 2 - 2.8 ** 2);
      const keyhole: P3[] = [[2.8, 11, -49 + j], [2.8, 11, -38]];
      for (let a = 0; a <= 180; a += 22.5) keyhole.push([2.8 * Math.cos(deg(a)), 11, -38 + 2.8 * Math.sin(deg(a))]);
      keyhole.push([-2.8, 11, -49 + j]);
      const a0 = (Math.atan2(j, -2.8) * 180) / Math.PI;
      for (let a = a0; a <= 410.5; a += 20) keyhole.push([4.4 * Math.cos(deg(a)), 11, -49 + 4.4 * Math.sin(deg(a))]);
      const fit = isoFit([...flange, ...flatRect(-8.6, -58, 8.6, -6, 3, 11), ...flatSlot(0, 0, 0, 19, 1), ...flatSlot(0, 0, 0, 17.5, -11.5)]);
      return {
        w: fit.w,
        h: fit.h,
        scalable: true,
        node: (
          <g transform={fit.at}>
            <IsoCyl x={0} z={0} r={17.5} y0={-11.5} y1={0} />
            <ellipse {...isoEllipse(0, 0.6, 0, 19)} fill={METAL_LIT} {...stroke} />
            <ellipse {...isoEllipse(0, 0.6, 0, 15.5)} fill={METAL} {...inner} />
            {/* the arm: its side with the step down into the cup, its top, and its open end over the cup */}
            <path d={isoPath([[8.6, 11, -6], [8.6, 11, -58], [8.6, 4, -58], [8.6, 4, -28], [8.6, 1.5, -25], [8.6, 1.5, -6]])} fill={METAL} {...stroke} />
            <path d={isoPath(flatRect(-8.6, -58, 8.6, -6, 3, 11))} fill={METAL_LIT} {...stroke} />
            <path d={isoPath(keyhole)} fill={PAPER} {...inner} />
            <IsoPanHead x={0} y={11} z={-15} r={3.2} h={1.4} />
            <path d={isoPath([[-8.6, 1.5, -6], [-8.6, 11, -6], [8.6, 11, -6], [8.6, 1.5, -6], [7.4, 1.5, -6], [7.4, 9.8, -6], [-7.4, 9.8, -6], [-7.4, 1.5, -6]])} fill={METAL} {...stroke} />
            {/* the knuckle going down into the cup, seen through the flange's window */}
            <path d={isoPath([[6, 7, -6], [6, 7, 5], [6, 0, 5], [6, 0, -6]])} fill={METAL} {...inner} />
            <path d={isoPath([[-6, 7, 5], [6, 7, 5], [6, 0, 5], [-6, 0, 5]])} fill={METAL} {...inner} />
            <path d={isoPath([[-6, 7, -6], [6, 7, -6], [6, 7, 5], [-6, 7, 5]])} fill={METAL_LIT} {...inner} />
            <IsoSlab top={flange} t={2.5} />
            {[-24, 24].map((x) => (
              <g key={x}>
                <ellipse {...isoEllipse(x, 2.5, 7.5, 3.6)} fill={METAL} {...fine} />
                <ellipse {...isoEllipse(x, 2.5, 7.5, 2.2)} fill={PAPER} {...inner} />
              </g>
            ))}
          </g>
        ),
      };
    }
    case "hingePlate": {
      // a pressed-steel cross mounting plate as the manuals draw it (A13): the wings across with a countersunk slot in
      // each raised pad, and the body the hinge arm slides onto, `len` high with a ledge down its side, two holes in
      // its top and the screw that holds the arm in the middle; `dia` sets the wings' span
      const h = Math.max(4, len),
        x = Math.max(10, dia / 2 - 6),
        l = Math.min(5, h / 2) + 0.5;
      const pad = (sx: number) => (
        <g key={sx}>
          <IsoSlab top={flatRect(sx - 6.3, -6.3, sx + 6.3, 6.3, 2, 3)} t={2} />
          <path d={isoPath(flatSlot(sx, 0, 2, 3.4, 3))} fill={METAL} {...fine} />
          <path d={isoPath(flatSlot(sx, 0, 2, 2.1, 3))} fill={PAPER} {...inner} />
        </g>
      );
      // the body's hat section, outside and in, as its near end shows it
      const hat: P2[] = [[-7, 0], [-7, l], [-5.5, l], [-5.5, h], [5.5, h], [5.5, l], [7, l], [7, 0]];
      const hollow: P2[] = [[-6, 0], [-6, l - 1], [-4.5, l - 1], [-4.5, h - 1], [4.5, h - 1], [4.5, l - 1], [6, l - 1], [6, 0]];
      const strip = (a: P2, b: P2) => isoPath([[a[0], a[1], -22], [b[0], b[1], -22], [b[0], b[1], 22], [a[0], a[1], 22]]);
      const fit = isoFit([...flatRect(-x - 7, -7, x + 7, 7, 2.5, 0), ...hat.flatMap(([u, v]): P3[] => [[u, v, -22], [u, v, 22]]), ...flatSlot(0, 0, 0, 4.2, h + 4.8)]);
      return {
        w: fit.w,
        h: fit.h,
        scalable: true,
        node: (
          <g transform={fit.at}>
            <path d={isoPath(flatRect(-x - 7, -7, x + 7, 7, 2.5, 1))} fill={METAL_LIT} {...stroke} />
            {pad(-x)}
            <path d={strip([7, 0], [7, l])} fill={METAL} {...inner} />
            <path d={strip([5.5, l], [7, l])} fill={METAL_LIT} {...inner} />
            <path d={strip([5.5, l], [5.5, h])} fill={METAL} {...inner} />
            <path d={strip([-5.5, h], [5.5, h])} fill={METAL_LIT} {...stroke} />
            <path d={isoPath(hat.map(([u, v]): P3 => [u, v, 22]))} fill={METAL} {...stroke} />
            <path d={isoPath(hollow.map(([u, v]): P3 => [u, v, 22]))} fill={PAPER} {...inner} />
            {[-11, 11].map((z) => (
              <g key={z}>
                <ellipse {...isoEllipse(0, h, z, 3)} fill={METAL} {...fine} />
                <ellipse {...isoEllipse(0, h, z, 1.8)} fill={PAPER} {...inner} />
              </g>
            ))}
            {pad(x)}
            <IsoCyl x={0} z={0} r={2.4} y0={h} y1={h + 2.4} top={METAL} />
            <IsoPanHead x={0} y={h + 2.4} z={0} r={4.2} h={2.4} />
          </g>
        ),
      };
    }
    case "cornerFoot":
      // from below: a right-angled plastic foot with its three screw holes
      return {
        w: 50,
        h: 50,
        scalable: true,
        node: (
          <g>
            <path d="M0 -25 L0 25 L50 25 Z" fill={PLASTIC} {...stroke} />
            <path d="M5 -13 L5 20 L38 20 Z" fill="none" {...fine} />
            {[[5.5, -10], [5.5, 18.5], [35, 18.5]].map(([x, y]) => (
              <circle key={x + "," + y} cx={x + 3} cy={y - 1.5} r={2} fill={PAPER} {...stroke} />
            ))}
          </g>
        ),
      };
    case "glide":
      return { w: 20, h: 10, scalable: true, node: <g><path d="M0 -1 V2 A10 3.6 0 0 0 20 2 V-1" fill={PLASTIC} {...stroke} /><ellipse cx={10} cy={-1} rx={10} ry={3.6} fill={PLASTIC} {...stroke} /></g> };
    case "glideStrip":
      // a stick-on plastic glide seen from its open side: a rounded plate ringed by short ribs with gaps between them
      return {
        w: 60,
        h: 18,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-9} width={60} height={18} rx={3} fill={PLASTIC} {...stroke} />
            {[
              [3, 15],
              [17, 26],
              [34, 43],
              [45, 57],
            ].map(([a, b]) => (
              <g key={a}>
                <rect x={a} y={-7.4} width={b - a} height={2.6} fill={PAPER} {...fine} />
                <rect x={a} y={4.8} width={b - a} height={2.6} fill={PAPER} {...fine} />
              </g>
            ))}
            {[3, 54.4].map((x) => (
              <rect key={x} x={x} y={-3} width={2.6} height={6} fill={PAPER} {...fine} />
            ))}
          </g>
        ),
      };
    case "plug": {
      const ribs = [];
      for (let x = 5; x < len - 3; x += 4) ribs.push(<path key={x} d={`M${x} ${-r} L${x + 1.6} 0 L${x} ${r}`} fill="none" {...fine} />);
      return {
        w: len,
        h: dia + 3,
        scalable: true,
        node: (
          <g>
            <path d={`M1.5 ${-r} H${len - 2} L${len} 0 L${len - 2} ${r} H1.5 Z`} fill={PLASTIC} {...stroke} />
            {ribs}
            <rect x={0} y={-r - 1.5} width={1.6} height={dia + 3} rx={0.5} fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    }
    case "castor":
      // standing up: the pin on top, the wheel underneath
      return {
        w: 52,
        h: 80,
        scalable: false,
        node: (
          <g>
            <rect x={21.5} y={-40} width={9} height={21} rx={2} fill={METAL} {...stroke} />
            <rect x={15} y={-20} width={22} height={4} rx={1.5} fill={PLASTIC} {...stroke} />
            <circle cx={28} cy={14} r={25} fill={PLASTIC} {...stroke} />
            <circle cx={28} cy={14} r={6} fill={PAPER} {...stroke} />
            <path d="M8 -16 H40 C46 -16 48 -12 48 -6 L46 4 H10 L6 -8 C6 -13 6 -16 8 -16 Z" fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    case "flatHinge":
      // two leaves with screw holes, the pin between them
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            {[0, len / 2 + 3].map((x) => (
              <rect key={x} x={x} y={-dia / 2} width={len / 2 - 3} height={dia} rx={2} fill={METAL} {...stroke} />
            ))}
            <rect x={len / 2 - 4} y={-dia / 2 - 1} width={8} height={dia + 2} rx={4} fill={METAL} {...stroke} />
            {[len * 0.17, len * 0.83].flatMap((x) => [-dia / 4, dia / 4].map((y) => <circle key={`${x}:${y}`} cx={x} cy={y} r={2.2} fill={PAPER} {...stroke} />))}
          </g>
        ),
      };
    case "roller":
      // a plate with two screw holes, an arm, and the wheel on top
      return {
        w: len,
        h: dia + 26,
        scalable: true,
        node: (
          <g transform={`translate(0 ${(dia + 26) / 2 - 4})`}>
            <rect x={len / 2 - 4} y={-22} width={8} height={20} rx={2} fill={METAL} {...stroke} />
            <circle cx={len / 2} cy={-22 - dia / 2 + 4} r={dia / 2} fill={PLASTIC} {...stroke} />
            <circle cx={len / 2} cy={-22 - dia / 2 + 4} r={3} fill={PAPER} {...stroke} />
            <rect x={0} y={-3} width={len} height={7} rx={2} fill={METAL} {...stroke} />
            {[len * 0.18, len * 0.82].map((x) => (
              <circle key={x} cx={x} cy={0.5} r={1.6} fill={PAPER} {...stroke} />
            ))}
          </g>
        ),
      };
    case "hook":
      // lying down: the thread on the left, the plate, the stem and its ball
      return {
        w: len + 12,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-2.5} width={12} height={5} rx={1} fill={METAL} {...stroke} />
            <rect x={12} y={-dia * 0.28} width={3} height={dia * 0.56} rx={1} fill={METAL} {...stroke} />
            <rect x={15} y={-4} width={len - 18} height={8} rx={3} fill={METAL} {...stroke} />
            <circle cx={len + 12 - dia * 0.42} cy={0} r={dia * 0.42} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "connector":
      // a flat strip with a screw hole at each end
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={len} height={dia} rx={3} fill={METAL} {...stroke} />
            {[len / 4, (3 * len) / 4].map((x) => (
              <circle key={x} cx={x} cy={0} r={2.6} fill={PAPER} {...stroke} />
            ))}
          </g>
        ),
      };
    case "clip":
      // side on: the flat head on the left, the stem with its barbs
      return {
        w: 18,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={3.5} height={dia} rx={1} fill={PLASTIC} {...stroke} />
            <path d="M3.5 -2.6 H14 L18 0 L14 2.6 H3.5 Z" fill={PLASTIC} {...stroke} />
            <path d="M8 -2.6 L10 -4 M12 -2.6 L14 -4 M8 2.6 L10 4 M12 2.6 L14 4" fill="none" {...fine} />
          </g>
        ),
      };
    case "strap":
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={len} height={dia} rx={4} fill={PLASTIC} {...stroke} />
            {[10, len - 10].map((x) => (
              <circle key={x} cx={x} cy={0} r={2.6} fill={PAPER} {...stroke} />
            ))}
          </g>
        ),
      };
    case "nut": {
      const R = dia * 0.95;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => `${R + R * Math.cos((k * Math.PI) / 3)},${R * Math.sin((k * Math.PI) / 3)}`).join(" ");
      return { w: R * 2, h: R * 1.8, scalable: true, node: <g><polygon points={pts} fill={METAL} {...stroke} /><circle cx={R} cy={0} r={dia / 2} fill={PAPER} {...stroke} /></g> };
    }
    case "washer":
      return { w: dia, h: dia, scalable: true, node: <g><circle cx={dia / 2} cy={0} r={dia / 2} fill={METAL} {...stroke} /><circle cx={dia / 2} cy={0} r={dia / 5} fill={PAPER} {...stroke} /></g> };
    case "stud":
      return {
        w: len,
        h: dia * 1.25,
        scalable: true,
        node: (
          <g>
            <path d={thread(3, len, (dia / 2) * 0.8, 1.4)} fill={METAL} {...stroke} />
            <rect x={0} y={(-dia * 1.25) / 2} width={3} height={dia * 1.25} rx={1} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "clamp":
      return { w: len, h: 10, scalable: true, node: <path d={`M0 -5 V5 H${len} V-5 H${len - 2.5} V2.5 H2.5 V-5 Z`} fill={METAL} {...stroke} /> };
    case "angle":
      return {
        w: len,
        h: len,
        scalable: true,
        node: (
          <g transform={`translate(0 ${-len / 2})`}>
            <path d={`M0 0 H2.5 V${len - 2.5} H${len} V${len} H0 Z`} fill={METAL} {...stroke} />
            <circle cx={len * 0.6} cy={len - 1.2} r={0.9} fill={PAPER} {...fine} />
          </g>
        ),
      };
    case "foot":
      return {
        w: len + 14,
        h: dia,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, 14, 4, 1.6)} fill={METAL} {...stroke} />
            <rect x={14} y={-dia / 2} width={len} height={dia} rx={3} fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    case "spacer":
      return { w: len, h: dia, scalable: true, node: <rect x={0} y={-dia / 2} width={len} height={dia} rx={2} fill={PLASTIC} {...stroke} /> };
    case "cap":
      return { w: dia, h: dia, scalable: true, node: <g><circle cx={dia / 2} cy={0} r={dia / 2} fill={PLASTIC} {...stroke} /><circle cx={dia / 2} cy={0} r={dia / 2 - 2} fill="none" {...fine} /></g> };
    case "gasLift":
      // lying down: the narrow end that drops into the base on the left, the rod for the seat on the right
      return {
        w: 132,
        h: 26,
        scalable: false,
        node: (
          <g>
            <rect x={0} y={-7} width={26} height={14} rx={2} fill={METAL} {...stroke} />
            <rect x={24} y={-13} width={82} height={26} rx={3} fill={METAL} {...stroke} />
            <path d="M34 -6 H96" {...fine} />
            <rect x={104} y={-9} width={6} height={18} rx={1.5} fill={PLASTIC} {...stroke} />
            <rect x={110} y={-5.5} width={22} height={11} rx={2} fill={METAL} {...stroke} />
          </g>
        ),
      };
  }
}

/**
 * Hardware drawing. `fit` draws it inside a square box of that many pixels;
 * `pxPerMm` draws it at real size.
 */
export function HwArt({ kind, len, dia, fit = 72, pxPerMm, className }: { kind: HwKind; len: number; dia: number; fit?: number; pxPerMm?: number; className?: string }) {
  const d = draw(kind, len, dia);
  const pad = Math.max(d.w, d.h) * 0.06 + 1;
  const vbW = d.w + pad * 2, vbH = d.h + pad * 2;
  let width: number, height: number;
  if (pxPerMm && d.scalable) {
    width = vbW * pxPerMm;
    height = vbH * pxPerMm;
  } else {
    const k = fit / Math.max(vbW, vbH * 1.15);
    width = vbW * k;
    height = vbH * k;
  }
  return (
    <svg className={className} viewBox={`${-pad} ${-d.h / 2 - pad} ${vbW} ${vbH}`} width={width} height={height} aria-hidden="true" overflow="visible">
      {d.node}
    </svg>
  );
}

export function canActualSize(kind: HwKind) {
  return kind !== "runner" && kind !== "castor" && kind !== "gasLift";
}
