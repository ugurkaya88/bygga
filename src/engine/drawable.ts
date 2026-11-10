import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { faceMaterial, hullMaterial, lineMaterial, withBoxHullDir, withCylHullDir, withHullDir } from "./materials";
import type { HwKind, Hole, PartType } from "@/lib/types";
import { FACE } from "./materials";
import { PALETTE } from "./palette";

export class Drawable {
  root = new THREE.Group();
  faces: THREE.ShaderMaterial[] = [];
  lines: LineMaterial[] = [];
  thin: LineMaterial[] = [];
  hulls: THREE.ShaderMaterial[] = [];
  meshes: THREE.Mesh[] = [];
  base: THREE.Color[] = [];
  opacity = 1;
}

interface GeoEntry {
  geo: THREE.BufferGeometry;
  edges: LineSegmentsGeometry;
}
const geoCache = new Map<string, GeoEntry>();

function entry(key: string, make: () => THREE.BufferGeometry, threshold = 30): GeoEntry {
  let e = geoCache.get(key);
  if (!e) {
    const geo = make();
    const edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, threshold));
    e = { geo, edges };
    geoCache.set(key, e);
  }
  return e;
}

type HullKind = "cyl" | "radial" | "box" | null;

export function addSolid(
  d: Drawable,
  key: string,
  make: () => THREE.BufferGeometry,
  color: THREE.Color,
  o: { hull?: HullKind; half?: THREE.Vector3Tuple; cy?: number; position?: THREE.Vector3Tuple; rotation?: THREE.Vector3Tuple; edges?: boolean; parent?: THREE.Object3D } = {},
) {
  const e = entry(key, () => {
    const g = make();
    if (o.hull === "cyl") withCylHullDir(g, o.cy ?? 0);
    else if (o.hull === "box" && o.half) withBoxHullDir(g, ...o.half);
    else if (o.hull === "radial") {
      g.computeBoundingBox();
      const c = new THREE.Vector3();
      g.boundingBox!.getCenter(c);
      withHullDir(g, c);
    }
    return g;
  });
  const holder = new THREE.Group();
  if (o.position) holder.position.set(...o.position);
  if (o.rotation) holder.rotation.set(...o.rotation);
  const fm = faceMaterial(color);
  const mesh = new THREE.Mesh(e.geo, fm);
  holder.add(mesh);
  d.faces.push(fm);
  d.base.push(color.clone());
  d.meshes.push(mesh);
  if (o.edges !== false) {
    const lm = lineMaterial(1.6);
    const ls = new LineSegments2(e.edges, lm);
    holder.add(ls);
    d.lines.push(lm);
  }
  if (o.hull) {
    const hm = hullMaterial(1.6);
    const hull = new THREE.Mesh(e.geo, hm);
  if (o.hull === "box") hm.uniforms.uWidth.value = 2;
    hull.renderOrder = -1;
    holder.add(hull);
    d.hulls.push(hm);
  }
  (o.parent ?? d.root).add(holder);
  return holder;
}

/* ---------------- parts ---------------- */

const MAT_COLOR: Record<string, THREE.Color> = {
  board: FACE.board,
  fiber: FACE.fiber,
  wood: FACE.wood,
  metal: FACE.metal,
  soft: FACE.soft,
  glass: FACE.glass,
};

export function partDrawable(p: PartType, holes: Hole[]) {
  const d = new Drawable();
  const [sx, sy, sz] = p.size;
  const color = MAT_COLOR[p.material] ?? FACE.board;
  if (p.pieces) {
    for (const q of p.pieces) {
      const [qx, qy, qz] = q.size;
      const mat = q.material ?? p.material;
      const c = MAT_COLOR[mat] ?? FACE.board;
      const at = { position: q.pos, rotation: q.rot };
      if (q.shape === "halfcyl") addSolid(d, `hcyl:${qx}:${qy}`, () => halfDisc(qx, qy), c, { hull: "radial", ...at });
      else if (q.shape === "cyl") addSolid(d, `cyl:${qx}:${qy}`, () => new THREE.CylinderGeometry(qx / 2, qx / 2, qy, 32), c, { hull: "cyl", ...at });
      else if (mat === "soft") addSolid(d, `soft:${qx}:${qy}:${qz}`, () => roundedBox(qx, qy, qz, Math.min(42, qy / 2.4, qx / 3, qz / 3)), c, { hull: "box", half: [qx / 2, qy / 2, qz / 2], edges: false, ...at });
      else addSolid(d, `box:${qx}:${qy}:${qz}`, () => new THREE.BoxGeometry(qx, qy, qz), c, at);
    }
  } else if (p.shape === "cyl") {
    addSolid(d, `cyl:${sx}:${sy}`, () => new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 32), color, { hull: "cyl" });
  } else if (p.material === "soft") {
    addSolid(d, `soft:${sx}:${sy}:${sz}`, () => roundedBox(sx, sy, sz, Math.min(42, sy / 2.4, sx / 3, sz / 3)), color, { hull: "box", half: [sx / 2, sy / 2, sz / 2], edges: false });
  } else {
    addSolid(d, `box:${sx}:${sy}:${sz}`, () => new THREE.BoxGeometry(sx, sy, sz), color);
  }
  if (holes.length) {
    const pts: number[] = [];
    const seg = 14;
    const n = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const h of holes) {
      n.set(...h.n).normalize();
      a.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
      b.copy(n).cross(a).normalize();
      c.set(...h.p).addScaledVector(n, 0.35);
      // a countersunk hole shows its wide mouth round the bore, as the manuals draw it
      for (const r of h.sink ? [h.r, Math.max(4.6, h.r * 2.8)] : [h.r])
        for (let i = 0; i < seg; i++) {
          const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
          pts.push(
            c.x + (a.x * Math.cos(t0) + b.x * Math.sin(t0)) * r,
            c.y + (a.y * Math.cos(t0) + b.y * Math.sin(t0)) * r,
            c.z + (a.z * Math.cos(t0) + b.z * Math.sin(t0)) * r,
            c.x + (a.x * Math.cos(t1) + b.x * Math.sin(t1)) * r,
            c.y + (a.y * Math.cos(t1) + b.y * Math.sin(t1)) * r,
            c.z + (a.z * Math.cos(t1) + b.z * Math.sin(t1)) * r,
          );
        }
    }
    const g = new LineSegmentsGeometry();
    g.setPositions(pts);
    const lm = lineMaterial(1);
    d.root.add(new LineSegments2(g, lm));
    d.thin.push(lm);
  }
  return d;
}

/** Half a disc (one half of a round table top): flat edge along x at the back, curve towards the front, centred on its box. */
function halfDisc(dia: number, h: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, dia / 2, 0, Math.PI, false);
  s.lineTo(dia / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h / 2, -dia / 4);
  return g;
}

function roundedBox(w: number, h: number, dpt: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -dpt / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + dpt - r);
  shape.quadraticCurveTo(x + w, y + dpt, x + w - r, y + dpt);
  shape.lineTo(x + r, y + dpt);
  shape.quadraticCurveTo(x, y + dpt, x, y + dpt - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - r, bevelEnabled: true, bevelThickness: r / 2, bevelSize: r / 3, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - r) / 2, 0);
  return g;
}

/* ---------------- hardware ---------------- */

const TAPE = new THREE.Color(PALETTE.tape); // a grey adhesive pad, as the manuals shade it
const FILM = new THREE.Color(PALETTE.film); // the paper backing on an adhesive pad

const cyl = (r: number, h: number, seg = 18) => () => new THREE.CylinderGeometry(r, r, h, seg);

type Pt = [number, number];
type Axis = "x" | "y" | "z";
const AXIS: Record<Axis, THREE.Vector3> = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** A closed outline through `pts`, each corner rounded off by its radius in `r` (one number for all, 0 for sharp). */
function rounded<T extends THREE.Path>(into: T, pts: Pt[], r: number | number[]) {
  const n = pts.length;
  pts.forEach((p, i) => {
    const rr = typeof r === "number" ? r : r[i];
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const sx = p[0] + ((a[0] - p[0]) / la) * rr, sy = p[1] + ((a[1] - p[1]) / la) * rr;
    if (i === 0) into.moveTo(sx, sy);
    else into.lineTo(sx, sy);
    if (rr > 0) into.quadraticCurveTo(p[0], p[1], p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr);
  });
  into.closePath();
  return into;
}

/** A slot for a screw: two half circles of radius `r`, `half` either side of (cx, cy) along the outline's y (or x). */
function slotPath(cx: number, cy: number, half: number, r: number, alongY = true) {
  const p = new THREE.Path();
  if (alongY) {
    p.absarc(cx, cy - half, r, Math.PI, 2 * Math.PI, false);
    p.absarc(cx, cy + half, r, 0, Math.PI, false);
  } else {
    p.absarc(cx + half, cy, r, -Math.PI / 2, Math.PI / 2, false);
    p.absarc(cx - half, cy, r, Math.PI / 2, 1.5 * Math.PI, false);
  }
  p.closePath();
  return p;
}

/** A bent strip of sheet steel seen end on: the open polyline `pts` drawn `t` mm thick, as a closed outline. */
function sheet(pts: Pt[], t: number) {
  const normal = (p: Pt, q: Pt): Pt => {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
  };
  const side = (s: number) =>
    pts.map((p, i): Pt => {
      const n0 = i > 0 ? normal(pts[i - 1], p) : normal(p, pts[i + 1]);
      const n1 = i < pts.length - 1 ? normal(p, pts[i + 1]) : n0;
      // the mitre at a bend: along the two normals' mean, long enough to stay t/2 off both faces
      const mx = n0[0] + n1[0], my = n0[1] + n1[1], ml = Math.hypot(mx, my);
      const k = t / 2 / ((mx / ml) * n0[0] + (my / ml) * n0[1]);
      return [p[0] + (s * mx * k) / ml, p[1] + (s * my * k) / ml];
    });
  return new THREE.Shape([...side(1), ...side(-1).reverse()].map(([x, y]) => new THREE.Vector2(x, y)));
}

/**
 * A flat outline cut from sheet: `shape` extruded `depth` mm, its x running along `u`, its y along `v` and the
 * depth along the third axis from `from` up.
 */
function slab(shape: THREE.Shape, depth: number, u: Axis, v: Axis, from = 0, curveSegments = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  const w = (["x", "y", "z"] as Axis[]).find((a) => a !== u && a !== v)!;
  const W = AXIS[w].clone();
  // keep the turn a rotation, not a mirror, so the faces still face out
  const flip = AXIS[u].clone().cross(AXIS[v]).dot(W) < 0;
  if (flip) W.negate();
  g.applyMatrix4(new THREE.Matrix4().makeBasis(AXIS[u], AXIS[v], W));
  g.translate(...(AXIS[w].clone().multiplyScalar(from + (flip ? depth : 0)).toArray() as THREE.Vector3Tuple));
  return g;
}

/** A pan-head screw's head with its cross, standing on y = 0 of `parent` (a group the caller places and turns). */
function panHead(d: Drawable, r: number, h: number, parent: THREE.Object3D) {
  const m = FACE.hwMetal;
  addSolid(d, `ph:${r}:${h}`, () => new THREE.CylinderGeometry(r * 0.84, r, h, 24), m, { hull: "cyl", position: [0, h / 2, 0], parent });
  addSolid(d, `ph:x:${r}`, () => new THREE.BoxGeometry(r * 1.2, 0.4, 0.55), m, { position: [0, h + 0.1, 0], parent });
  addSolid(d, `ph:z:${r}`, () => new THREE.BoxGeometry(0.55, 0.4, r * 1.2), m, { position: [0, h + 0.1, 0], parent });
}

const inkCache = new Map<string, LineSegmentsGeometry>();
/** Thin lines drawn on a fitting's face, as the manuals draw a countersunk hole's rim or a keyhole: closed loops. */
function inkLoops(d: Drawable, key: string, make: () => THREE.Vector3[][], parent: THREE.Object3D = d.root) {
  let g = inkCache.get(key);
  if (!g) {
    const pts: number[] = [];
    for (const l of make())
      l.forEach((a, i) => {
        const b = l[(i + 1) % l.length];
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      });
    g = new LineSegmentsGeometry().setPositions(pts);
    inkCache.set(key, g);
  }
  const lm = lineMaterial(1);
  parent.add(new LineSegments2(g, lm));
  d.thin.push(lm);
}

/** A circle of radius r round (x, z) in the plane y, as points for inkLoops. */
const ring = (x: number, y: number, z: number, r: number, n = 24) =>
  Array.from({ length: n }, (_, i) => new THREE.Vector3(x + r * Math.cos((i / n) * Math.PI * 2), y, z + r * Math.sin((i / n) * Math.PI * 2)));

/**
 * Hardware is modelled along +Y with the origin on the surface it goes into.
 * Everything below y = 0 ends up inside the panel.
 */
export function hwDrawable(kind: HwKind, len: number, dia: number) {
  const d = new Drawable();
  const metal = FACE.hwMetal, wood = FACE.hwWood, plastic = FACE.hwPlastic;
  const r = dia / 2;
  switch (kind) {
    case "dowel":
      // seated 12 mm deep, like real face-drilled holes, so it never shows through a 15 mm panel
      addSolid(d, `dowel:${len}:${dia}`, cyl(r, len, 16), wood, { hull: "cyl", position: [0, len / 2 - 12, 0] });
      break;
    case "camScrew":
      addSolid(d, "cs:thread", cyl(2.9, 11, 12), metal, { hull: "cyl", position: [0, -5.5, 0] });
      addSolid(d, "cs:neck", cyl(2.2, 17, 12), metal, { hull: "cyl", position: [0, 8.5, 0] });
      addSolid(d, "cs:head", () => new THREE.SphereGeometry(3.6, 14, 10), metal, { hull: "radial", position: [0, 19.5, 0], edges: false });
      break;
    case "cam": {
      // the face stands 0.4 mm proud of the board, so the two never share a plane and flicker
      addSolid(d, "cam:body", cyl(7.4, 12.8, 32), metal, { hull: "cyl", position: [0, -6.0, 0] });
      addSolid(d, "cam:slot", () => new THREE.BoxGeometry(9, 0.8, 1.6), FACE.hwMetal, { position: [0, 0.8, 0] });
      addSolid(d, "cam:arrow", () => new THREE.ConeGeometry(1.4, 2.6, 3), FACE.hwMetal, { position: [5.2, 0.8, 0], rotation: [0, 0, -Math.PI / 2], edges: true });
      break;
    }
    case "screw": {
      // countersunk, as the manuals draw chipboard screws: a thin rim just proud of the surface, a cone under it
      // that sinks into the board, then the shank
      const hr = Math.max(dia, 3.2);
      const cone = hr - r * 0.92;
      addSolid(d, `sc:shank:${len}:${dia}`, cyl(r * 0.92, len - 2, 10), metal, { hull: "cyl", position: [0, -(len - 2) / 2 - 2, 0] });
      addSolid(d, `sc:tip:${dia}`, () => new THREE.ConeGeometry(r * 0.92, 2.6, 10), metal, { position: [0, -len - 0.7, 0], rotation: [Math.PI, 0, 0], edges: false });
      addSolid(d, `sc:rim:${dia}`, cyl(hr, 0.6, 18), metal, { hull: "cyl", position: [0, 0.3, 0] });
      addSolid(d, `sc:cone:${dia}`, () => new THREE.CylinderGeometry(hr, r * 0.92, cone, 18), metal, { hull: "cyl", position: [0, -cone / 2, 0] });
      addSolid(d, `sc:x1:${dia}`, () => new THREE.BoxGeometry(hr * 1.2, 0.4, 0.5), metal, { position: [0, 0.7, 0] });
      addSolid(d, `sc:x2:${dia}`, () => new THREE.BoxGeometry(0.5, 0.4, hr * 1.2), metal, { position: [0, 0.7, 0] });
      break;
    }
    case "nail":
      addSolid(d, `nail:${len}`, cyl(r, len, 8), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, "nail:head", cyl(r * 1.7, 0.7, 12), metal, { hull: "cyl", position: [0, 0.35, 0] });
      break;
    case "pin":
      addSolid(d, `pin:${dia}`, cyl(r, 16, 12), metal, { hull: "cyl" });
      addSolid(d, `pin:collar:${dia}`, cyl(r + 1.2, 1.2, 14), metal, { hull: "cyl", position: [0, 0.6, 0] });
      break;
    case "legScrew":
      addSolid(d, `leg:${len}`, cyl(r, len, 14), metal, { hull: "cyl" });
      break;
    case "bolt":
      addSolid(d, `bolt:${len}:${dia}`, cyl(r, len, 12), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, `bolt:head:${dia}`, cyl(dia * 0.85, 5, 18), metal, { hull: "cyl", position: [0, 2.5, 0] });
      addSolid(d, `bolt:hex:${dia}`, cyl(dia * 0.4, 0.6, 6), FACE.hwMetal, { position: [0, 5.2, 0] });
      break;
    case "plate":
      addSolid(d, "plate", () => new THREE.BoxGeometry(70, 3, 70), metal, { position: [0, 1.5, 0] });
      addSolid(d, "plate:sock", cyl(9, 10, 18), metal, { hull: "cyl", position: [0, 8, 0] });
      break;
    case "bracket":
      addSolid(d, "br:h", () => new THREE.BoxGeometry(40, 2, 32), metal, { position: [0, 1, 0] });
      addSolid(d, "br:v", () => new THREE.BoxGeometry(40, 42, 2), metal, { position: [0, 21, -15] });
      break;
    case "runner":
      addSolid(d, `run:${len}`, () => new THREE.BoxGeometry(20, 11, len), metal, { position: [0, 5.5, 0] });
      addSolid(d, `run:lip:${len}`, () => new THREE.BoxGeometry(4, 6, len), metal, { position: [-8, 14, 0] });
      break;
    case "knob":
      addSolid(d, "knob:stem", cyl(5.5, 12, 14), wood, { hull: "cyl", position: [0, 6, 0] });
      addSolid(d, "knob:head", () => new THREE.SphereGeometry(14, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), wood, { hull: "radial", position: [0, 14, 0], edges: false });
      break;
    case "handle":
      for (const x of [-len / 2, len / 2]) addSolid(d, "hd:post", cyl(5, 26, 12), metal, { hull: "cyl", position: [x, 13, 0] });
      addSolid(d, `hd:bar:${len}`, () => new THREE.CylinderGeometry(6, 6, len + 24, 14).rotateZ(Math.PI / 2), metal, { hull: "radial", position: [0, 30, 0] });
      break;
    case "hinge": {
      // a cup hinge as it hangs with the door shut (local -x is the hinged edge, y = 0 the door's inner face, z
      // along the edge), drawn after the manuals' A12 at real size, whatever len and dia say:
      // - the 35 mm cup sunk in the door, its rim on the face;
      // - the screw flange over it on the side away from the edge, with a countersunk hole 24 mm either side of the
      //   cup, a short slot 6 to 9 mm off its centre (the guides place the screws at either);
      // - the arm standing into the cabinet along the side panel: a pressed channel, deeper over the cup where the
      //   knuckle pin is, the adjusting screw on top, and the keyhole 37 mm in that the plate's screw holds.
      // The arm's inside top (x = 6) rests on a 10 mm plate when the cup is 4 mm in from the panel's inner face (a
      // cup 22 mm from the edge of a door over an 18 mm side); with the cup further in, its sides straddle the
      // plate's body.
      // The arm, with its pin, adjusting screw and keyhole, is a group of its own ("arm") that the player turns
      // about a line along z (stage.ts poseArm): opened out on a loose door, as the manuals draw it, or held on its
      // plate while the door swings. Left alone it is shut, as here.
      const arm = new THREE.Group();
      arm.name = "arm";
      // where it folds when opened out on a loose door: over the cup, high enough that the arm's sides clear the rim
      arm.userData = { knuckle: new THREE.Vector3(1.5, 6, 0) };
      d.root.add(arm);
      addSolid(d, "hg:cup", cyl(17.5, 11.9, 32), metal, { hull: "cyl", position: [0, -5.55, 0] });
      addSolid(
        d,
        "hg:rim",
        () => {
          const s = new THREE.Shape().absarc(0, 0, 19, 0, Math.PI * 2, false);
          s.holes.push(new THREE.Path().absarc(0, 0, 15.5, 0, Math.PI * 2, true));
          return slab(s, 1.2, "x", "z", 0, 24);
        },
        metal,
      );
      // the flange: a plate with the cup's window cut on the arm's side, and a raised face on it round the holes'
      // countersunk mouths
      const flange = (e: number, hole: number) => {
        const s = rounded(new THREE.Shape(), [[e, -31 + e], [15 - e, -31 + e], [15 - e, 31 - e], [e, 31 - e], [e, 9 + e], [6 + e, 9 + e], [6 + e, -9 - e], [e, -9 - e]], [5 - e, 5 - e, 5 - e, 5 - e, 1, 1, 1, 1]);
        s.holes.push(slotPath(7.5, -24, 1.5, hole, false), slotPath(7.5, 24, 1.5, hole, false));
        return s;
      };
      addSolid(d, "hg:flange", () => slab(flange(0, 2.3), 1.6, "x", "z", 0), metal);
      addSolid(d, "hg:face", () => slab(flange(0.7, 3.6), 1.4, "x", "z", 1.6), metal);
      // the knuckle going down into the cup, the arm's front part over it with the pin, and the arm
      addSolid(d, "hg:knuckle", () => new THREE.BoxGeometry(7, 6, 13), metal, { position: [1.5, -1, 0] });
      // the link from the knuckle to the arm's pin, a unit long along y for the player to stretch between the two
      // (stage.ts poseArm): hidden while they are together, it shows when the arm is held on its plate away from a
      // door turned open
      const link = new THREE.Group();
      link.name = "link";
      link.visible = false;
      link.userData = { from: new THREE.Vector3(1.5, 1, 0), to: new THREE.Vector3(1.5, 4, 0) };
      d.root.add(link);
      addSolid(d, "hg:link", () => new THREE.BoxGeometry(4, 1, 10), metal, { parent: link });
      addSolid(d, "hg:front", () => slab(sheet([[-8, -3], [-8, 6.6], [8, 6.6], [8, -3]], 1.2), 21, "z", "x", 1), metal, { parent: arm });
      addSolid(d, "hg:arm", () => slab(sheet([[-8, -0.4], [-8, 6.6], [8, 6.6], [8, -0.4]], 1.2), 28, "z", "x", 22), metal, { parent: arm });
      addSolid(d, "hg:pin", () => new THREE.CylinderGeometry(2.2, 2.2, 18.4, 16).rotateX(Math.PI / 2), metal, { hull: "radial", position: [1.5, 4, 0], parent: arm });
      const adj = new THREE.Group();
      adj.position.set(7.2, 14, 0);
      adj.rotation.z = -Math.PI / 2;
      arm.add(adj);
      panHead(d, 3.2, 1.4, adj);
      inkLoops(
        d,
        "hg:keyhole",
        () => {
          // a slot along the arm for the plate screw's shank, opening into a round hole its head goes through
          const a = Math.atan2(2.8, 39.1 - 42.5);
          const k = new THREE.Path().moveTo(39.1, -2.8).lineTo(33.6, -2.8);
          k.absarc(33.6, 0, 2.8, -Math.PI / 2, Math.PI / 2, true);
          k.lineTo(39.1, 2.8);
          k.absarc(42.5, 0, 4.4, a, -a, true);
          return [k.getPoints(10).map((p) => new THREE.Vector3(7.5, p.x, p.y))];
        },
        arm,
      );
      break;
    }
    case "glide":
      addSolid(d, "glide", cyl(10, 4, 18), plastic, { hull: "cyl", position: [0, 2, 0] });
      break;
    case "glideStrip": {
      // a stick-on plastic glide, its long side along local z: the adhesive pad on the board, a thin plate, and a rim of
      // short ribs with gaps between them round the open face (as the manuals draw it)
      const tape = 0.6, plate = 1.5, rib = Math.max(1, len - tape - plate);
      const half = dia / 2;
      // the pad and its paper backing in groups of their own, so the player can stick the pad on and peel the
      // backing (stage.ts padPose). The backing is a chain of thin strips from the far end to the tab that sticks
      // out at the near one, so it can curl off like paper; only its long sides and two ends are outlined.
      const pad = new THREE.Group();
      pad.name = "pad";
      d.root.add(pad);
      addSolid(d, `gs:tape:${dia}`, () => new THREE.BoxGeometry(17, tape, dia - 1), TAPE, { position: [0, tape / 2, 0], edges: false, parent: pad });
      const film = new THREE.Group();
      film.name = "film";
      film.visible = false;
      pad.add(film);
      const flen = dia + 4.5, n = 24, ds = flen / n;
      const segs: THREE.Object3D[] = [];
      for (let i = 0; i < n; i++) {
        const seg = addSolid(d, `gs:film:${ds.toFixed(3)}`, () => new THREE.BoxGeometry(17.2, 0.3, ds + 0.15), FILM, { edges: false, parent: film });
        const ends = i === 0 ? "far" : i === n - 1 ? "tab" : "mid";
        const lm = lineMaterial(1.6);
        seg.add(new LineSegments2(stripEdges(ds, ends), lm));
        d.lines.push(lm);
        segs.push(seg);
      }
      film.userData = { z0: -half - 0.5, ds, segs };
      addSolid(d, `gs:plate:${dia}`, () => new THREE.BoxGeometry(18, plate, dia), plastic, { position: [0, tape + plate / 2, 0] });
      const y = tape + plate + rib / 2;
      const runs: [number, number][] = [
        [-half + 1, -half * 0.52],
        [-half * 0.46, -0.03 * dia],
        [0.03 * dia, half * 0.46],
        [half * 0.52, half - 1],
      ];
      for (const [a, b] of runs)
        for (const x of [-7.6, 7.6]) addSolid(d, `gs:rib:${(b - a).toFixed(1)}:${rib}`, () => new THREE.BoxGeometry(2.4, rib, b - a), plastic, { position: [x, y, (a + b) / 2] });
      for (const z of [-half + 2.2, half - 2.2]) addSolid(d, `gs:end:${rib}`, () => new THREE.BoxGeometry(6, rib, 2.4), plastic, { position: [0, y, z] });
      break;
    }
    case "hingePlate": {
      // a pressed-steel cross mounting plate, after the manuals' A13 (local y out of the panel): the wings across along
      // x, a raised pad on each with a countersunk slot along z where its screw goes in (14 mm either side of the
      // middle on the usual 40 mm plate), and the body the hinge arm slides onto along z, `len` high with a ledge
      // down each side, two countersunk holes in its top and the screw that holds the arm in the middle
      const h = Math.max(4, len);
      const x = Math.max(10, dia / 2 - 6);
      const slots = (s: THREE.Shape, at: number[], r: number) => {
        for (const cx of at) s.holes.push(slotPath(cx, 0, 2, r));
        return s;
      };
      addSolid(d, `hp:base:${x}`, () => slab(slots(rounded(new THREE.Shape(), [[-x - 7, -7], [x + 7, -7], [x + 7, 7], [-x - 7, 7]], 2.5), [-x, x], 2.1), 1, "x", "z", 0), metal);
      for (const sx of [-x, x])
        addSolid(d, "hp:pad", () => slab(slots(rounded(new THREE.Shape(), [[-6.3, -6.3], [6.3, -6.3], [6.3, 6.3], [-6.3, 6.3]], 2), [0], 3.4), 2, "x", "z", 1), metal, { position: [sx, 0, 0] });
      const ledge = Math.min(5, h / 2);
      addSolid(d, `hp:body:${h}`, () => slab(sheet([[-6.5, 0], [-6.5, ledge], [-5, ledge], [-5, h - 0.5], [5, h - 0.5], [5, ledge], [6.5, ledge], [6.5, 0]], 1), 44, "x", "y", -22), metal);
      inkLoops(d, `hp:holes:${h}`, () => [-11, 11].flatMap((z) => [ring(0, h + 0.3, z, 1.8), ring(0, h + 0.3, z, 3)]));
      addSolid(d, "hp:shank", cyl(2.4, 2.4, 14), metal, { hull: "cyl", position: [0, h + 1.2, 0] });
      const head = new THREE.Group();
      head.position.set(0, h + 2.4, 0);
      d.root.add(head);
      panHead(d, 4.2, 2.4, head);
      break;
    }
    case "cornerFoot": {
      // a right-angled plastic corner foot under a board: the right angle at local -x -z, centred on its centroid
      const a = dia;
      addSolid(
        d,
        `cf:${len}:${a}`,
        () => {
          const sh = new THREE.Shape();
          sh.moveTo(-a / 3, a / 3);
          sh.lineTo((2 * a) / 3, a / 3);
          sh.lineTo(-a / 3, (-2 * a) / 3);
          sh.closePath();
          const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
          g.rotateX(-Math.PI / 2);
          return g;
        },
        plastic,
      );
      break;
    }
    case "plug":
      addSolid(d, `plug:${len}`, cyl(r, len, 12), plastic, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, "plug:lip", cyl(r + 1.5, 1.5, 14), plastic, { hull: "cyl", position: [0, 0.75, 0] });
      break;
    case "castor": {
      // a pin that pushes into the base, a hood and twin wheels trailing behind the pin
      addSolid(d, "ca:pin", cyl(5.5, 22, 12), metal, { hull: "cyl", position: [0, -11, 0] });
      addSolid(d, "ca:collar", cyl(9, 3, 16), plastic, { hull: "cyl", position: [0, 1.5, 0] });
      addSolid(d, `ca:hood:${dia}`, () => new THREE.BoxGeometry(dia * 0.68, len - r - 2, dia * 0.9), plastic, { position: [0, 3 + (len - r - 2) / 2, -dia * 0.12] });
      for (const x of [-1, 1])
        addSolid(d, `ca:wheel:${dia}`, () => new THREE.CylinderGeometry(r, r, dia * 0.26, 24).rotateZ(Math.PI / 2), plastic, { hull: "radial", position: [x * dia * 0.21, len - r, -dia * 0.16] });
      break;
    }
    case "flatHinge":
      // two leaves either side of a pin, lying flat across a joint
      for (const x of [-1, 1]) addSolid(d, `fh:leaf:${len}:${dia}`, () => new THREE.BoxGeometry(len / 2 - 3, 1.6, dia), metal, { position: [x * (len / 4 + 1.5), 0.8, 0] });
      addSolid(d, `fh:pin:${dia}`, () => new THREE.CylinderGeometry(3, 3, dia, 12).rotateX(Math.PI / 2), metal, { hull: "radial", position: [0, 2.2, 0] });
      break;
    case "hook":
      // a coat peg: a thread into the wood, a round plate against it, a stem, and a ball on the end
      addSolid(d, "hk:thread", cyl(2.5, 12, 10), metal, { hull: "cyl", position: [0, -6, 0] });
      addSolid(d, `hk:plate:${dia}`, cyl(r * 0.55, 3, 20), metal, { hull: "cyl", position: [0, 1.5, 0] });
      addSolid(d, `hk:stem:${len}`, cyl(4, len - 12, 14), metal, { hull: "cyl", position: [0, 3 + (len - 12) / 2, 0] });
      addSolid(d, `hk:ball:${dia}`, () => new THREE.SphereGeometry(r * 0.42, 18, 12), metal, { hull: "radial", position: [0, len - 6, 0], edges: false });
      break;
    case "roller":
      // a sliding door's roller: a plate screwed to the door's edge, an arm, and a wheel that runs in the track
      addSolid(d, `ro:plate:${len}`, () => new THREE.BoxGeometry(len, 3, 14), metal, { position: [0, 1.5, 0] });
      addSolid(d, "ro:arm", () => new THREE.BoxGeometry(8, len * 0.45, 8), metal, { position: [0, 3 + len * 0.22, 0] });
      addSolid(d, `ro:wheel:${dia}`, () => new THREE.CylinderGeometry(r, r, 7, 22).rotateX(Math.PI / 2), plastic, { hull: "radial", position: [0, 3 + len * 0.45 + r * 0.4, 0] });
      break;
    case "connector":
      // a flat strip screwed across the joint between two sofa sections
      addSolid(d, `cn:${len}:${dia}`, () => new THREE.BoxGeometry(len, 2, dia), metal, { position: [0, 1, 0] });
      break;
    case "clip":
      // a push-in plastic clip: a stem into the hole and a flat head
      addSolid(d, "clip:stem", cyl(2.6, 9, 10), plastic, { hull: "cyl", position: [0, -4.5, 0] });
      addSolid(d, `clip:head:${dia}`, () => new THREE.BoxGeometry(dia, 3, dia * 0.7), plastic, { position: [0, 1.5, 0] });
      break;
    case "strap":
      // a wall strap lying flat against the panel
      addSolid(d, `st:${len}:${dia}`, () => new THREE.BoxGeometry(dia, 1.4, len), plastic, { position: [0, 0.7, 0] });
      break;
    case "nut":
      addSolid(d, `nut:${dia}`, cyl(dia * 0.95, Math.max(3, len), 6), metal, { hull: "cyl", position: [0, Math.max(3, len) / 2, 0] });
      break;
    case "washer":
      addSolid(d, `wa:${dia}`, cyl(r, 1.6, 20), metal, { hull: "cyl", position: [0, 0.8, 0] });
      break;
    case "stud":
      addSolid(d, `sd:${len}:${dia}`, cyl(r * 0.8, len, 12), metal, { hull: "cyl", position: [0, len / 2 - 10, 0] });
      addSolid(d, `sd:head:${dia}`, cyl(r * 1.25, 3, 16), metal, { hull: "cyl", position: [0, len - 8.5, 0] });
      break;
    case "clamp":
      addSolid(d, `cl:${len}:${dia}`, () => new THREE.BoxGeometry(len, 2.5, dia), metal, { position: [0, 1.25, 0] });
      for (const x of [-1, 1]) addSolid(d, `cl:lip:${dia}`, () => new THREE.BoxGeometry(2.5, 9, dia), metal, { position: [x * (len / 2 - 1.25), 6, 0] });
      break;
    case "angle":
      addSolid(d, `an:h:${len}:${dia}`, () => new THREE.BoxGeometry(dia, 2, len), metal, { position: [0, 1, 0] });
      addSolid(d, `an:v:${len}:${dia}`, () => new THREE.BoxGeometry(dia, len, 2), metal, { position: [0, len / 2, -len / 2 + 1] });
      break;
    case "foot":
      addSolid(d, "ft:thread", cyl(4, 14, 10), metal, { hull: "cyl", position: [0, -7, 0] });
      addSolid(d, `ft:body:${len}:${dia}`, cyl(r, len, 20), plastic, { hull: "cyl", position: [0, len / 2, 0] });
      break;
    case "spacer":
      addSolid(d, `sp:${len}:${dia}`, cyl(r, len, 18), plastic, { hull: "cyl", position: [0, len / 2, 0] });
      addSolid(d, "sp:screw", cyl(2, 10, 10), metal, { hull: "cyl", position: [0, -5, 0] });
      break;
    case "cap":
      addSolid(d, `cap:${dia}`, cyl(r, 2, 18), plastic, { hull: "cyl", position: [0, 1, 0] });
      break;
    case "gasLift": {
      // the narrow end drops into the base; the rod at the top goes up into the seat
      addSolid(d, "gl:foot", cyl(14, 60, 18), metal, { hull: "cyl", position: [0, -30, 0] });
      addSolid(d, `gl:body:${len}:${dia}`, cyl(r, len - 40, 24), metal, { hull: "cyl", position: [0, (len - 40) / 2, 0] });
      addSolid(d, "gl:ring", cyl(18, 6, 20), plastic, { hull: "cyl", position: [0, len - 37, 0] });
      addSolid(d, "gl:rod", cyl(11, 36, 16), metal, { hull: "cyl", position: [0, len - 18, 0] });
      break;
    }
  }
  return d;
}

const GRAPHITE = new THREE.Color(PALETTE.graphite);

/** A pencil line `len` mm long along local x, or a round mark `dot` mm across (a drilled hole), lying on the surface (local +y out). */
const stripCache = new Map<string, LineSegmentsGeometry>();
/** The outline of one strip of a paper backing (17.4 mm wide, 0.3 thick, `ds` long): its long edges, and the
 * end edge too when it is the backing's far end or tab, so a chain of strips reads as one sheet. */
function stripEdges(ds: number, ends: "far" | "tab" | "mid") {
  const key = `${ds.toFixed(3)}:${ends}`;
  let g = stripCache.get(key);
  if (!g) {
    const pts: number[] = [];
    for (const x of [-8.7, 8.7]) for (const y of [-0.15, 0.15]) pts.push(x, y, -ds / 2, x, y, ds / 2);
    if (ends !== "mid") {
      const z = ends === "far" ? -ds / 2 : ds / 2;
      for (const y of [-0.15, 0.15]) pts.push(-8.7, y, z, 8.7, y, z);
    }
    g = new LineSegmentsGeometry().setPositions(pts);
    stripCache.set(key, g);
  }
  return g;
}

export function markDrawable(len: number, dot: number) {
  const d = new Drawable();
  if (dot > 0) addSolid(d, `mark:dot:${dot}`, cyl(dot / 2, 0.8, 20), GRAPHITE, { position: [0, 0.4, 0], edges: false });
  else addSolid(d, `mark:line:${len}`, () => new THREE.BoxGeometry(len, 0.8, 2), GRAPHITE, { position: [0, 0.4, 0], edges: false });
  return d;
}

export function wallDrawable(w: number, h: number) {
  const d = new Drawable();
  addSolid(d, `wall:${w}:${h}`, () => new THREE.BoxGeometry(w, h, 40), FACE.wall);
  return d;
}
