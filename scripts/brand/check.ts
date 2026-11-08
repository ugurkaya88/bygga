/**
 * Checks the brand switch (src/lib/brand.ts):
 *
 * 1. Bygga's drawing palette (PALETTES.bygga in src/engine/palette.ts) holds exactly the colours its engine was
 *    drawn with before the switch: the literals in src/engine/materials.ts, drawable.ts and stage.ts at 84707b5.
 * 2. Every text and ground pair of the warm theme (src/app/rehber/tokens.css) passes WCAG AA: 4.5:1 for body
 *    text, 3:1 for the pairs only meant for large or bold text (on the accent).
 *
 * Exits 1 on a Bygga mismatch or a pair under its minimum. Run from the Bygga checkout on Node 24:
 *   node --experimental-transform-types --no-warnings --import ./scripts/voice/register.mjs scripts/brand/check.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PALETTES } from "@/engine/palette";

const BASE = "84707b5";
const ROOT = path.resolve(import.meta.dirname, "../..");
let failed = false;

/* ---------- 1. Bygga's palette against the engine at BASE ---------- */

const old = (file: string) => execFileSync("git", ["-C", ROOT, "show", `${BASE}:${file}`], { encoding: "utf8" });
const materials = old("src/engine/materials.ts");
const drawable = old("src/engine/drawable.ts");
const stage = old("src/engine/stage.ts");

function color(src: string, name: string): string {
  const m = src.match(new RegExp(`\\b${name} = new THREE\\.Color\\("(#[0-9a-fA-F]{6})"\\)`));
  if (!m) throw new Error(`no ${name} colour at ${BASE}`);
  return m[1].toLowerCase();
}

const faceBlock = materials.match(/export const FACE[^{]*\{([\s\S]*?)\n\};/);
if (!faceBlock) throw new Error(`no FACE table in materials.ts at ${BASE}`);
const face = Object.fromEntries([...faceBlock[1].matchAll(/(\w+): new THREE\.Color\("(#[0-9a-fA-F]{6})"\)/g)].map((m) => [m[1], m[2].toLowerCase()]));

// float shade = d > 0.72 ? 1.0 : (d > 0.18 ? 0.968 : (d > -0.2 ? 0.938 : 0.915));
const shadeExpr = materials.match(/float shade = ([^;]+);/);
if (!shadeExpr) throw new Error(`no shade steps in materials.ts at ${BASE}`);
const shade = [...shadeExpr[1].matchAll(/[?:]\s*(\d*\.\d+)/g)].map((m) => Number(m[1])).slice(1);

const stops = [...stage.matchAll(/addColorStop\([^,]+,\s*"rgba\((\d+),\s*(\d+),\s*(\d+),/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
if (!stops.length || stops.some((s) => s.join() !== stops[0].join())) throw new Error(`the floor shadow at ${BASE} is not one colour`);
const clear = stage.match(/setClearColor\(0x([0-9a-fA-F]{6}),\s*1\)/);
if (!clear) throw new Error(`no close-up clear colour in stage.ts at ${BASE}`);

const want: Record<string, unknown> = {
  ink: color(materials, "INK"),
  inkOld: color(materials, "INK_OLD"),
  tintNew: color(materials, "TINT_NEW"),
  ...Object.fromEntries(Object.entries(face).map(([k, v]) => [`face.${k}`, v])),
  shade,
  tape: color(drawable, "TAPE"),
  film: color(drawable, "FILM"),
  graphite: color(drawable, "GRAPHITE"),
  shadow: stops[0],
  closeUp: "#" + clear[1].toLowerCase(),
};
const p = PALETTES.bygga;
const have: Record<string, unknown> = {
  ink: p.ink,
  inkOld: p.inkOld,
  tintNew: p.tintNew,
  ...Object.fromEntries(Object.entries(p.face).map(([k, v]) => [`face.${k}`, v])),
  shade: p.shade,
  tape: p.tape,
  film: p.film,
  graphite: p.graphite,
  shadow: p.shadow,
  closeUp: p.closeUp,
};
const show = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : JSON.stringify(v));
const keys = [...new Set([...Object.keys(want), ...Object.keys(have)])];
const off = keys.filter((k) => show(want[k]) !== show(have[k]));
if (off.length) {
  failed = true;
  console.log(`bygga palette: ${off.length} of ${keys.length} values differ from the engine at ${BASE}`);
  for (const k of off) console.log(`  ${k}: palette ${show(have[k] ?? "missing")}, engine ${show(want[k] ?? "missing")}`);
} else console.log(`bygga palette: equal to the engine at ${BASE} (${keys.length} values)`);

/* ---------- 2. the warm theme's contrast ---------- */

const tokensCss = readFileSync(path.join(ROOT, "src/app/rehber/tokens.css"), "utf8");
const block = tokensCss.match(/\[data-brand="rehber"\]\s*\{([^}]*)\}/);
if (!block) throw new Error("no [data-brand=\"rehber\"] block in src/app/rehber/tokens.css");
const tok = Object.fromEntries([...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
const need = (name: string) => {
  const v = tok[name];
  if (!v) throw new Error(`--${name} is not a colour in src/app/rehber/tokens.css`);
  return v;
};

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const grounds: [string, string][] = [
  ["ground", need("page")],
  ["raised", need("raised")],
  ["card", need("card")],
  ["accent soft", need("accent-soft")],
  ["sunk", need("sunk")],
];
const texts: [string, string][] = [
  ["ink", need("ink")],
  ["ink 2", need("ink-2")],
  ["ink 3", need("ink-3")],
  ["accent text", need("accent-text")],
  ["danger", need("danger")],
];
const pairs: { text: string; tc: string; ground: string; gc: string; min: number }[] = [];
for (const [text, tc] of texts) for (const [ground, gc] of grounds) pairs.push({ text, tc, ground, gc, min: 4.5 });
pairs.push({ text: "white", tc: "#ffffff", ground: "button", gc: need("btn"), min: 4.5 });
pairs.push({ text: "on-btn", tc: need("on-btn"), ground: "button", gc: need("btn"), min: 4.5 });
pairs.push({ text: "white", tc: "#ffffff", ground: "accent text", gc: need("accent-text"), min: 4.5 });
pairs.push({ text: "ink", tc: need("ink"), ground: "accent", gc: need("accent"), min: 3 });
pairs.push({ text: "white", tc: "#ffffff", ground: "accent", gc: need("accent"), min: 3 });

console.log("rehber contrast (WCAG 2; AA: 4.5 for body text, 3 for large or bold text):");
const pad = (s: string, n: number) => s + " ".repeat(Math.max(1, n - s.length));
for (const x of pairs) {
  const r = ratio(x.tc, x.gc);
  const ok = r >= x.min;
  if (!ok) failed = true;
  const note = x.min < 4.5 ? "large or bold only" : "body text";
  console.log(`  ${pad(`${x.text} ${x.tc}`, 22)}on ${pad(`${x.ground} ${x.gc}`, 22)}${r.toFixed(2).padStart(6)}  ${ok ? "ok" : `FAIL, under ${x.min}`}  (${note})`);
}

// the drawing, for reference: lines against the boards they are drawn on
const r = PALETTES.rehber;
console.log("rehber drawing (for reference):");
for (const [name, a, b] of [
  ["edge lines on boards", r.ink, r.face.board],
  ["earlier steps' lines on boards", r.inkOld, r.face.board],
  ["edge lines on the new part's tint", r.ink, r.tintNew],
  ["edge lines on the wall", r.ink, r.face.wall],
] as const)
  console.log(`  ${pad(name, 36)}${a} on ${b}  ${ratio(a, b).toFixed(2)}`);

console.log(failed ? "result: FAIL" : "result: ok");
process.exit(failed ? 1 : 0);
