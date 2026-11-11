import type {
  HwItem,
  HwKind,
  HwType,
  Item,
  Mark,
  PartItem,
  PartMaterial,
  PartPiece,
  PartSwing,
  PartType,
  Plan,
  Pose,
  ProductSpec,
  Step,
  StepKind,
  ToolId,
  ToolNeed,
  Vec3,
  WarnId,
} from "../types";
import { t } from "../i18n";
import { rotate, toLocal, unrotate } from "./math";

const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

export interface HwDef {
  kind: HwKind;
  len: number;
  dia: number;
  notIncluded?: boolean;
  name?: string; // the fitting's own name when the kind's general one doesn't fit ("Catch", "Knob bolt")
}

export const HW = {
  dowel: { kind: "dowel", len: 30, dia: 8 },
  camScrew: { kind: "camScrew", len: 34, dia: 7 },
  cam: { kind: "cam", len: 13, dia: 15 },
  screwS: { kind: "screw", len: 14, dia: 3.5 },
  screwM: { kind: "screw", len: 30, dia: 4 },
  screwL: { kind: "screw", len: 50, dia: 5 },
  nail: { kind: "nail", len: 20, dia: 1.6 },
  pin: { kind: "pin", len: 16, dia: 5 },
  legScrew: { kind: "legScrew", len: 70, dia: 8 },
  boltS: { kind: "bolt", len: 40, dia: 6 },
  boltL: { kind: "bolt", len: 70, dia: 6 },
  plate: { kind: "plate", len: 80, dia: 80 },
  bracket: { kind: "bracket", len: 60, dia: 40 },
  knob: { kind: "knob", len: 25, dia: 30 },
  handle: { kind: "handle", len: 128, dia: 12 },
  hinge: { kind: "hinge", len: 50, dia: 35 },
  hingePlate: { kind: "hingePlate", len: 10, dia: 40 },
  glide: { kind: "glide", len: 4, dia: 20 },
  glideStrip: { kind: "glideStrip", len: 5, dia: 60 }, // a stick-on plastic strip: len its thickness, dia its length
  wallScrew: { kind: "screw", len: 50, dia: 5, notIncluded: true },
  plug: { kind: "plug", len: 35, dia: 8, notIncluded: true },
  castor: { kind: "castor", len: 58, dia: 50 },
  gasLift: { kind: "gasLift", len: 200, dia: 50 },
  connector: { kind: "connector", len: 120, dia: 30 },
  roller: { kind: "roller", len: 44, dia: 26 },
  flatHinge: { kind: "flatHinge", len: 60, dia: 34 },
  hook: { kind: "hook", len: 55, dia: 22 },
  runner: { kind: "runner", len: 400, dia: 40 },
  clip: { kind: "clip", len: 12, dia: 10 },
  strap: { kind: "strap", len: 110, dia: 20 },
  nut: { kind: "nut", len: 5, dia: 6 },
  washer: { kind: "washer", len: 1.5, dia: 16 },
  stud: { kind: "stud", len: 22, dia: 8 },
  clamp: { kind: "clamp", len: 44, dia: 18 },
  angle: { kind: "angle", len: 30, dia: 24 },
  foot: { kind: "foot", len: 30, dia: 32 },
  cornerFoot: { kind: "cornerFoot", len: 22, dia: 50 },
  cap: { kind: "cap", len: 2, dia: 14 },
  spacer: { kind: "spacer", len: 20, dia: 16 },
} satisfies Record<string, HwDef>;

/** The fitting a placed one was made from, own name included, to fit the same again (rows repeating a frame). */
export function defOf(ht: HwType): HwDef {
  return { kind: ht.kind, len: ht.len, dia: ht.dia, notIncluded: ht.notIncluded, ...(ht.name !== t(`hw.${ht.kind}`) ? { name: ht.name } : {}) };
}

export function hwSpecText(kind: HwKind, len: number, dia: number) {
  switch (kind) {
    case "dowel":
    case "screw":
    case "nail":
    case "legScrew":
    case "bolt":
    case "plug":
      return `${dia} × ${len} mm`;
    case "camScrew":
      return `${len} mm`;
    case "cam":
      return `${dia} mm`;
    case "pin":
      return `${dia} mm`;
    case "runner":
      return `${len} mm`;
    case "handle":
      return `${len} mm`;
    case "nut":
    case "washer":
      return `${dia} mm`;
    case "stud":
      return `${dia} × ${len} mm`;
    default:
      return "";
  }
}

const DUR = { part: 0.95, hw: 0.6, lift: 0.6, pad: 4.0, swing: 1.5, turn: 0.7 }; // lift: the extra for a part lifted over from where it waited (stage.ts LIFT); pad: a glide got ready and pressed on (stage.ts PAD_DUR); swing: a door held open, then swung shut (stage.ts SWING_HOLD + SWING_DUR); turn: a cam turned to lock (stage.ts CAM_TURN)

export interface StepDef {
  title: string;
  detail?: string;
  tools?: ToolId[];
  people?: 1 | 2;
  repeat?: number;
  scene?: string;
  pose?: Pose;
  warnings?: WarnId[];
  kind: StepKind;
  check?: "square";
  wall?: boolean;
  shift?: Vec3;
  marks?: Mark[];
  sub?: string[];
  bit?: number;
  weight?: number;
}

export interface FitOpts {
  on?: string;
  sink?: boolean; // goes in through a countersunk hole (a screw through one board into another)
  at: Vec3; // assembled frame (or scene frame when no parent)
  dir: Vec3;
  twist?: number;
  travel?: number;
  spin?: number;
  turn?: number;
  mate?: string; // part that receives the protruding end
  hole?: number | false;
  mateHole?: number;
  scale?: number;
  pad?: boolean; // a stick-on glide that gets its pad and has the backing peeled before it goes on (stage.ts PAD_DUR)
  press?: boolean; // a cam pressed in open and left unturned: a later step turns it (PlanBuilder.lock)
}

export class PlanBuilder {
  parts: PartType[] = [];
  hw = new Map<string, HwType>();
  items: Item[] = [];
  map = new Map<string, Item>();
  steps: Step[] = [];
  private n = 0;
  private t = 0;
  private end = 0;
  private gap = 0;
  private cur: Step | null = null;

  constructor(public spec: ProductSpec) {}

  part(name: string, size: Vec3, o: { shape?: "box" | "cyl"; material?: PartMaterial; extra?: boolean; label?: string } = {}) {
    const id = "p" + this.parts.length;
    this.parts.push({
      id,
      label: o.label ?? "",
      name,
      size,
      shape: o.shape ?? "box",
      material: o.material ?? "board",
      qty: 0,
      extra: o.extra,
    });
    return id;
  }

  /**
   * A part made of several boxes and cylinders (a star base, a cot side with its bars). The part is
   * centred on the bounding box of its pieces: `mid` is that centre in the frame the pieces were given
   * in, so placing the part at `mid` (unturned) puts every piece where it was drawn.
   */
  compound(name: string, pieces: PartPiece[], o: { material?: PartMaterial; extra?: boolean } = {}) {
    const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of pieces) {
      const [sx, sy, sz] = p.size;
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          for (const c of [-1, 1]) {
            const v = rotate([(a * sx) / 2, (b * sy) / 2, (c * sz) / 2], p.rot ?? [0, 0, 0]);
            for (let i = 0; i < 3; i++) {
              lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
              hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
            }
          }
    }
    const r = (n: number) => Math.round(n * 10) / 10;
    const mid: Vec3 = [r((lo[0] + hi[0]) / 2), r((lo[1] + hi[1]) / 2), r((lo[2] + hi[2]) / 2)];
    const type = this.part(name, [r(hi[0] - lo[0]), r(hi[1] - lo[1]), r(hi[2] - lo[2])], { material: o.material, extra: o.extra });
    this.parts[this.parts.length - 1].pieces = pieces.map((p) => ({ ...p, pos: [r(p.pos[0] - mid[0]), r(p.pos[1] - mid[1]), r(p.pos[2] - mid[2])] }));
    return { type, mid };
  }

  place(ref: string, pos: Vec3, rot: Vec3 = [0, 0, 0]) {
    const key = "i" + this.n++;
    const it: PartItem = { key, kind: "part", ref, final: { pos, rot }, states: [], holes: [] };
    this.items.push(it);
    this.map.set(key, it);
    return key;
  }

  partItem(key: string) {
    const it = this.map.get(key);
    if (!it || it.kind !== "part") throw new Error("not a part " + key);
    return it;
  }

  hole(key: string, at: Vec3, n: Vec3, r: number) {
    const it = this.partItem(key);
    it.holes.push({ p: toLocal(at, it.final.pos, it.final.rot), n: unrotate(n, it.final.rot), r });
  }

  hwType(def: HwDef) {
    const id = `${def.kind}-${def.len}-${def.dia}${def.notIncluded ? "-x" : ""}${def.name ? "-" + def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""}`;
    if (!this.hw.has(id)) {
      this.hw.set(id, {
        id,
        kind: def.kind,
        name: def.name ?? t(`hw.${def.kind}`),
        spec: hwSpecText(def.kind, def.len, def.dia),
        len: def.len,
        dia: def.dia,
        qty: 0,
        notIncluded: def.notIncluded,
      });
    }
    return id;
  }

  /* ---------- step context ---------- */

  step(def: StepDef, body: () => void) {
    const s: Step = {
      n: this.steps.length,
      title: def.title,
      detail: def.detail,
      tools: def.tools ?? [],
      people: def.people ?? 1,
      repeat: def.repeat,
      scene: def.scene ?? "main",
      pose: def.pose ?? "+y",
      warnings: def.warnings ?? [],
      kind: def.kind,
      check: def.check,
      wall: def.wall,
      shift: def.shift,
      marks: def.marks,
      sub: def.sub?.length ? def.sub : undefined,
      ...(def.bit ? { bit: def.bit } : {}),
      minutes: def.weight ?? 0,
    };
    this.steps.push(s);
    this.cur = s;
    this.t = 0.15;
    this.end = 0.15;
    this.gap = 0.22;
    body();
    this.cur = null;
    return s;
  }

  private get step_(): Step {
    if (!this.cur) throw new Error("outside step");
    return this.cur;
  }

  stagger(gap: number) {
    this.gap = gap;
  }
  then(pause = 0.12) {
    this.t = this.end + pause;
  }
  wait(sec: number) {
    this.t += sec;
  }

  private slot(dur: number) {
    const d = this.t;
    this.t += this.gap;
    this.end = Math.max(this.end, d + dur);
    return d;
  }

  /** Part reaches its assembled position in this step (a door with `swing` reaches it hung open, then swings shut). */
  add(key: string, from?: Vec3, o: { spin?: number; lift?: boolean; swing?: PartSwing } = {}) {
    const it = this.partItem(key);
    const s = this.step_;
    it.states.push({ step: s.n, scene: s.scene, pos: it.final.pos, rot: it.final.rot, from, spin: o.spin, lift: o.lift, swing: o.swing, delay: this.slot(DUR.part + (o.spin ? 0.4 : 0) + (o.lift ? DUR.lift : 0) + (o.swing ? DUR.swing : 0)) });
  }

  /** Where a fitting going in at `at` along `dir` meets a part: its hole is there, not where the fitting starts. */
  entry(key: string, at: Vec3, dir: Vec3, len: number): Vec3 {
    const it = this.partItem(key);
    const size = this.parts.find((p) => p.id === it.ref)?.size;
    if (!size) return at;
    const l = toLocal(at, it.final.pos, it.final.rot);
    const n = unrotate(dir, it.final.rot);
    const inside = (q: Vec3) => q.every((v, i) => Math.abs(v) <= size[i] / 2 + 0.5);
    if (inside(l)) return at;
    for (let t = 1; t <= len + 2; t++) {
      if (inside([l[0] + n[0] * t, l[1] + n[1] * t, l[2] + n[2] * t])) return [at[0] + dir[0] * t, at[1] + dir[1] * t, at[2] + dir[2] * t];
    }
    return at;
  }

  /** Part is shown somewhere else (laid flat, upside down...) from this step until it is added. */
  stage(key: string, pos: Vec3, rot: Vec3, from?: Vec3) {
    const it = this.partItem(key);
    const s = this.step_;
    it.states.push({ step: s.n, scene: s.scene, pos, rot, from, delay: this.slot(DUR.part) });
  }

  fit(def: HwDef, o: FitOpts) {
    const s = this.step_;
    const ref = this.hwType(def);
    const key = "h" + this.n++;
    let pos = o.at;
    let dir = o.dir;
    if (o.on) {
      const p = this.partItem(o.on);
      pos = toLocal(o.at, p.final.pos, p.final.rot);
      dir = unrotate(o.dir, p.final.rot);
      const r = o.hole === false ? 0 : (o.hole ?? holeR(def));
      // a screw through one board into another (FitOpts.sink) goes in through a countersunk hole
      if (r > 0) p.holes.push({ p: pos, n: [-dir[0], -dir[1], -dir[2]], r, sink: o.sink || undefined });
    }
    if (o.mate) this.hole(o.mate, this.entry(o.mate, o.at, o.dir, def.len), o.dir, o.mateHole ?? Math.max(holeR(def), 3));
    const travel = o.travel ?? defaultTravel(def);
    const extra = def.kind === "cam" ? (o.press ? 0 : DUR.turn) : o.spin ? 0.35 : o.pad ? DUR.pad - DUR.hw : 0;
    const it: HwItem = {
      key,
      kind: "hw",
      ref,
      parent: o.on,
      scene: o.on ? undefined : s.scene,
      step: s.n,
      pos,
      dir,
      twist: o.twist,
      travel,
      spin: o.spin ?? defaultSpin(def),
      turn: o.turn ?? (def.kind === "cam" ? Math.PI * 0.75 : undefined),
      delay: this.slot(DUR.hw + extra),
      scale: o.scale,
      pad: o.pad || undefined,
    };
    this.items.push(it);
    this.map.set(key, it);
    return key;
  }

  fits(def: HwDef, list: FitOpts[], gap = 0.06) {
    const g = this.gap;
    this.gap = gap;
    const keys = list.map((o) => this.fit(def, o));
    this.gap = g;
    return keys;
  }

  /**
   * A cam pressed in open in an earlier step (FitOpts.press) is turned to lock in this one. `open` is the way its
   * opening faced until now (assembled frame), toward its cam bolt.
   */
  lock(key: string, open: Vec3) {
    const it = this.map.get(key);
    if (!it || it.kind !== "hw") throw new Error("not a fitting " + key);
    const p = it.parent ? this.partItem(it.parent) : undefined;
    const r = (n: number) => Math.round(n * 1e4) / 1e4 || 0;
    it.lock = { step: this.step_.n, delay: this.slot(DUR.turn), open: (p ? unrotate(open, p.final.rot) : open).map(r) as Vec3 };
  }

  /** Hardware already in place on a part (e.g. the 2nd and 3rd drawer): appears with the part, no animation. */
  preset(def: HwDef, o: FitOpts) {
    const k = this.fit(def, { ...o, travel: 0, spin: 0, turn: 0 });
    const it = this.map.get(k) as HwItem;
    it.delay = 0;
    it.preset = true;
    return k;
  }

  /* ---------- finalize ---------- */

  build(): Plan {
    // drop unused parts, assign letters by first appearance
    const firstStep = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const it of this.items) {
      if (it.kind === "part") {
        if (!it.states.length) throw new Error(`part ${it.key} never added`);
        const s = Math.min(...it.states.map((x) => x.step));
        firstStep.set(it.ref, Math.min(firstStep.get(it.ref) ?? 1e9, s));
        counts.set(it.ref, (counts.get(it.ref) ?? 0) + 1);
      } else {
        const t = this.hw.get(it.ref)!;
        t.qty++;
      }
    }
    const used = this.parts.filter((p) => counts.has(p.id));
    used.sort((a, b) => (firstStep.get(a.id)! - firstStep.get(b.id)!) || this.parts.indexOf(a) - this.parts.indexOf(b));
    let li = 0;
    // past Z the letters double up (AA, AB...), and those parts keep the order they were lettered in
    const late = new Map<string, number>();
    for (const p of used) {
      p.qty = counts.get(p.id)!;
      if (!p.extra && !p.label && li >= LETTERS.length) late.set(p.id, li);
      p.label = p.extra ? "" : p.label || (li < LETTERS.length ? LETTERS[li++] : LETTERS[Math.floor(li / LETTERS.length) - 1] + LETTERS[li++ % LETTERS.length]);
    }
    const byLabel = (a: PartType, b: PartType) =>
      late.has(a.id) || late.has(b.id) ? (late.get(a.id) ?? -1) - (late.get(b.id) ?? -1) : a.label.localeCompare(b.label, undefined, { numeric: true });
    used.sort((a, b) => (a.extra ? 1 : 0) - (b.extra ? 1 : 0) || byLabel(a, b));

    // step weights -> minutes
    const weights = this.steps.map((s) => {
      if (s.minutes) return s.minutes;
      if (s.quiet) return 1.6;
      const parts = this.items.filter((i) => i.kind === "part" && i.states[0]?.step === s.n).length + this.items.filter((i) => i.kind === "part" && i.states.length > 1 && i.states.some((x, k) => k > 0 && x.step === s.n)).length * 0.5;
      // a cam pressed in earlier and turned now is this step's work as well
      const hws = this.items.filter((i) => i.kind === "hw" && ((i.step === s.n && !i.preset) || i.lock?.step === s.n)).length;
      return (0.8 + parts * 0.6 + hws * 0.12) * (s.repeat ?? 1);
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    this.steps.forEach((s, i) => {
      s.minutes = Math.max(1, Math.round((weights[i] / total) * this.spec.minutes));
    });

    // tools
    const toolSet = new Set<ToolId>();
    this.steps.forEach((s) => s.tools.forEach((t) => toolSet.add(t)));
    const order: ToolId[] = ["allen", "screwdriver", "flathead", "hammer", "wrench", "tape", "drill", "pencil", "level", "knife"];
    const tools: ToolNeed[] = order
      .filter((t) => toolSet.has(t) || t === "knife")
      .map((id) => {
        const n: ToolNeed = { id };
        if (id === "allen" || id === "wrench") n.included = true;
        if (id === "drill") {
          n.optional = true;
          n.why = t("tool.why.drill");
        }
        if (id === "tape") {
          n.optional = true;
          n.why = t("tool.why.tape");
        }
        if (id === "pencil" || id === "level") {
          n.optional = true;
          n.why = t("tool.why.marking");
        }
        if (id === "knife") {
          n.optional = true;
          n.why = t("tool.why.knife");
        }
        return n;
      });

    const hardware = [...this.hw.values()].sort((a, b) => (a.notIncluded ? 1 : 0) - (b.notIncluded ? 1 : 0));
    this.markDoorAdjust();

    return { spec: this.spec, parts: used, hardware, items: this.items, steps: this.steps, tools };
  }

  /**
   * Each step that hangs a door on its cup hinges shows how to line the door up with the hinges' three screws
   * (WarnId "adjust", outside the steps' cap of three). A door is a part carrying hinges (HwItem kind "hinge" with the
   * part as its parent). It is hung in the first step, once its hinges are on, that puts it in its place in the build
   * against more parts already there than parts coming in with it (a frame built the same way and moved in whole
   * brings its door along, it doesn't hang it), or in the step that fits its hinges if it was in place before. Drop-leaf and gateleg tables hinge their leaves, not
   * doors. Plans with no hinges are left as they were.
   */
  private markDoorAdjust() {
    if (this.spec.table?.leaves) return;
    const hinged = new Map<string, number>();
    for (const it of this.items) if (it.kind === "hw" && it.parent && this.hw.get(it.ref)?.kind === "hinge") hinged.set(it.parent, Math.max(hinged.get(it.parent) ?? -1, it.step));
    if (!hinged.size) return;
    const types = new Map(this.parts.map((p) => [p.id, p]));
    const box = (it: PartItem) => {
      const size = types.get(it.ref)?.size ?? [0, 0, 0];
      const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          for (const c of [-1, 1]) {
            const v = rotate([(a * size[0]) / 2, (b * size[1]) / 2, (c * size[2]) / 2], it.final.rot);
            for (let i = 0; i < 3; i++) {
              lo[i] = Math.min(lo[i], it.final.pos[i] + v[i]);
              hi[i] = Math.max(hi[i], it.final.pos[i] + v[i]);
            }
          }
      return { lo, hi };
    };
    // an inset door stands a few mm clear of the sides round it
    const touch = (a: { lo: Vec3; hi: Vec3 }, b: { lo: Vec3; hi: Vec3 }) => [0, 1, 2].every((i) => a.lo[i] - 6 <= b.hi[i] && b.lo[i] - 6 <= a.hi[i]);
    const inPlace = (it: PartItem, scene: string) =>
      it.states.filter((st) => st.scene === scene && st.pos.every((v, i) => Math.abs(v - it.final.pos[i]) < 0.5) && st.rot.every((v, i) => Math.abs(v - it.final.rot[i]) < 1e-3)).map((st) => st.step);
    const parts = this.items.filter((it): it is PartItem => it.kind === "part");
    const hung = new Set<number>();
    for (const [key, fitted] of hinged) {
      const door = this.map.get(key);
      if (!door || door.kind !== "part" || !door.states.length) continue;
      const scene = door.states[door.states.length - 1].scene;
      const placed = inPlace(door, scene);
      if (placed.some((n) => n < fitted)) {
        hung.add(fitted);
        continue;
      }
      // the parts it meets, other doors aside: more of them already there than coming in with it
      const near = parts.filter((p) => p !== door && !hinged.has(p.key) && touch(box(p), box(door)));
      const at = placed.find((n) => {
        if (n < fitted) return false;
        const there = near.filter((p) => inPlace(p, scene).some((m) => m < n)).length;
        const coming = near.filter((p) => inPlace(p, scene).includes(n)).length;
        return there > 0 && there > coming;
      });
      if (at !== undefined) hung.add(at);
    }
    for (const n of hung) {
      const s = this.steps[n];
      // a new array: rows share one step's warnings between their frames
      if (s && !s.warnings.includes("adjust")) s.warnings = [...s.warnings, "adjust"];
    }
  }
}

function holeR(def: HwDef) {
  switch (def.kind) {
    case "dowel":
      return 4;
    case "camScrew":
      return 2.5;
    case "cam":
      return 7.5;
    case "screw":
      return def.notIncluded ? 0 : 1.6;
    case "pin":
      return 2.5;
    case "legScrew":
      return 4;
    case "bolt":
    case "stud":
      return 3.5;
    default:
      return 0;
  }
}

function defaultTravel(def: HwDef) {
  switch (def.kind) {
    case "dowel":
      return 34;
    case "camScrew":
      return 30;
    case "cam":
      return 24;
    case "screw":
      return def.len + 14;
    case "nail":
      return 22;
    case "pin":
      return 18;
    case "legScrew":
      return 50;
    case "bolt":
      return def.len + 10;
    case "plug":
      return 40;
    case "knob":
    case "handle":
    case "foot":
    case "cornerFoot":
      return 40;
    case "nut":
    case "washer":
    case "stud":
    case "clip":
      return 26;
    case "cap":
      return 18;
    default:
      return 50;
  }
}

function defaultSpin(def: HwDef) {
  switch (def.kind) {
    case "camScrew":
      return 3;
    case "screw":
      return 4;
    case "bolt":
      return 3;
    case "legScrew":
    case "foot":
      return 2;
    case "nut":
      return 3;
    default:
      return 0;
  }
}
