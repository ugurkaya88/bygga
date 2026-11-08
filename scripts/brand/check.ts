/**
 * Checks the brand switch (src/lib/brand.ts):
 *
 * 1. Bygga's drawing palette (PALETTES.bygga in src/engine/palette.ts) holds exactly the colours its engine was
 *    drawn with before the switch: the literals in src/engine/materials.ts, drawable.ts and stage.ts at 84707b5.
 * 2. Every text and ground pair of the warm theme (src/app/rehber/tokens.css) passes WCAG AA: 4.5:1 for body
 *    text, 3:1 for the pairs only meant for large or bold text (on the accent).
 * 3. The pairs the panels use beyond the core tokens (selected states, hovers, the red and green grounds, icons),
 *    read from globals.css, tokens.css, panels.css and guide.css with var() resolved, pass the same minimums.
 * 4. For reference only: the drawing's lines against the colours its faces show (the face shader writes a hex's
 *    linear value), not the hex values in palette.ts.
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

/* ---------- 3. the pairs the panels use beyond the core tokens ---------- */

// Custom properties as a rehber page computes them: Bygga's :root (globals.css), then the rehber blocks of
// tokens.css and panels.css, with var() resolved. A pair below names its colours by property or by literal.
function cssBlock(file: string, selector: string) {
  const src = readFileSync(path.join(ROOT, file), "utf8");
  const at = src.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no ${selector} block in ${file}`);
  const body = src.slice(at, src.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const props: Record<string, string> = {
  ...cssBlock("src/app/globals.css", ":root"),
  ...cssBlock("src/app/rehber/tokens.css", '[data-brand="rehber"]'),
  ...cssBlock("src/app/rehber/panels.css", '[data-brand="rehber"]'),
};
function hex(v: string, seen: string[] = []): string {
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref) {
    if (seen.includes(ref[1]) || !props[ref[1]]) throw new Error(`--${ref[1]} does not resolve to a colour`);
    return hex(props[ref[1]], [...seen, ref[1]]);
  }
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return "#" + [...v.slice(1)].map((c) => c + c).join("").toLowerCase();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  throw new Error(`${v} is not a plain colour`);
}
const col = (v: string) => hex(v.startsWith("#") ? v : `var(--${v})`);

// the parts checklist keeps Bygga's greens (spec 3.1, "as now"); read them where guide.css sets them
const guideCss = readFileSync(path.join(ROOT, "src/app/guide.css"), "utf8");
const rule = (selector: string, prop: string) => {
  const m = guideCss.match(new RegExp(`\\n${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`));
  const v = m?.[1].match(new RegExp(`(?:^|;|\\n)\\s*${prop}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`));
  if (!v) throw new Error(`no ${prop} colour on ${selector} in src/app/guide.css`);
  return hex(v[1]);
};
const partsGreen = rule(".prow.ok", "background");
const tickAll = rule(".toggle.tickall.on", "color");
const tickAllGround = rule(".toggle.tickall.on", "background");
const okDot = rule(".pok", "background");

const used: { text: string; tc: string; ground: string; gc: string; min: number; where: string }[] = [
  // every selected state: on the accent for text with white, or on the accent soft with ink
  { text: "panel-on-hot", tc: col("panel-on-hot"), ground: "panel-hot", gc: col("panel-hot"), min: 4.5, where: "toggle.on, tbadge, fb-topic.on, going, pill-btn.on" },
  { text: "ink", tc: col("ink"), ground: "panel-picked", gc: col("panel-picked"), min: 4.5, where: "picked tool card, overview page.current" },
  { text: "ink 2", tc: col("ink-2"), ground: "panel-picked", gc: col("panel-picked"), min: 4.5, where: "picked card hints" },
  { text: "tick all", tc: tickAll, ground: "parts green", gc: tickAllGround, min: 4.5, where: "toggle.tickall.on (Bygga's literals)" },
  // hovers
  { text: "panel-on-btn", tc: col("panel-on-btn"), ground: "panel-btn-hover", gc: col("panel-btn-hover"), min: 4.5, where: "btn.primary:hover" },
  { text: "ink", tc: col("ink"), ground: "panel-sunk-hover", gc: col("panel-sunk-hover"), min: 4.5, where: "sunk rows and match buttons on hover" },
  { text: "ink 2", tc: col("ink-2"), ground: "panel-sunk-hover", gc: col("panel-sunk-hover"), min: 4.5, where: "sunk rows on hover" },
  // the missing-part and safety red ground, the parts checklist's green
  { text: "danger", tc: col("danger"), ground: "miss-soft", gc: col("miss-soft"), min: 4.5, where: "missbox b, the cover's safety icon" },
  { text: "ink 2", tc: col("ink-2"), ground: "miss-soft", gc: col("miss-soft"), min: 4.5, where: "missbox text" },
  { text: "ink", tc: col("ink"), ground: "parts green", gc: partsGreen, min: 4.5, where: "prow.ok" },
  { text: "ink 3", tc: col("ink-3"), ground: "parts green", gc: partsGreen, min: 4.5, where: "prow.ok small text" },
  // icons and shapes, 3:1
  { text: "panel-done-ico", tc: col("panel-done-ico"), ground: "accent", gc: col("accent"), min: 3, where: "the Done dot's check (icon)" },
  { text: "accent", tc: col("accent"), ground: "button", gc: col("btn"), min: 3, where: "the flipped tool card's icon" },
  { text: "white", tc: "#ffffff", ground: "ok dot", gc: okDot, min: 3, where: "pok tick (icon, Bygga's literal)" },
];
console.log("rehber pairs the panels use (by property, var() resolved):");
for (const x of used) {
  const r = ratio(x.tc, x.gc);
  const ok = r >= x.min;
  if (!ok) failed = true;
  console.log(`  ${pad(`${x.text} ${x.tc}`, 26)}on ${pad(`${x.ground} ${x.gc}`, 28)}${r.toFixed(2).padStart(6)}  ${ok ? "ok" : `FAIL, under ${x.min}`}  (${x.where})`);
}

/* ---------- 4. the drawing at the colours it shows, for reference ---------- */

// The face shader writes its colour without sRGB encoding, so a face shows the linear value of its hex (times the
// shading step, with the new part's tint mixed in first); lines (LineMaterial) are encoded and show their hex.
const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
function faceShows(face: string, shade = 1, tint = 0, tintHex = PALETTES.rehber.tintNew) {
  const f = rgb(face).map(lin);
  const t = rgb(tintHex).map(lin);
  return toHex(f.map((v, i) => (v * (1 - tint) + t[i] * tint) * shade));
}
const r = PALETTES.rehber;
const faces: [string, number][] = [
  ["top", 1],
  ["front", r.shade[0]],
  ["side", r.shade[1]],
  ["under", r.shade[2]],
];
console.log("rehber drawing at its shown colours (for reference; faces show the linear value of their hex):");
const board = faces.map(([n, s]) => `${n} ${faceShows(r.face.board, s)}`).join(", ");
console.log(`  board ${r.face.board} shows ${board}`);
const drawn: [string, string, string][] = [];
for (const [n, s] of faces.slice(0, 3)) drawn.push([`edge lines on the board's ${n}`, r.ink, faceShows(r.face.board, s)]);
for (const [n, s] of faces.slice(0, 3)) drawn.push([`earlier lines on the board's ${n}`, r.inkOld, faceShows(r.face.board, s)]);
// a new part is tinted 0.34 as it arrives and 0.24 once landed (stage.ts), 0.75 when lit or hovered
for (const a of [0.24, 0.34, 0.75]) drawn.push([`edge lines on the new part (tint ${a})`, r.ink, faceShows(r.face.board, 1, a)]);
drawn.push(["edge lines on the wall", r.ink, faceShows(r.face.wall)]);
drawn.push(["earlier lines on the wall", r.inkOld, faceShows(r.face.wall)]);
for (const [name, a, b] of drawn) console.log(`  ${pad(name, 42)}${a} on ${b}  ${ratio(a, b).toFixed(2)}`);
console.log(`  wall ${r.face.wall} shows ${faceShows(r.face.wall)}, board top ${faceShows(r.face.board)}: the wall is the lighter`);

console.log(failed ? "result: FAIL" : "result: ok");
process.exit(failed ? 1 : 0);
