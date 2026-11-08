"use client";

import type { Plan } from "@/lib/types";
import { shot } from "@/engine/thumbs";
import { t } from "@/lib/i18n";
import { BRAND, BRAND_INFO, displayName } from "@/lib/brand";

const W = 1080;
const H = 1350;
const REHBER = BRAND === "rehber";

type Colors = Record<"page" | "card" | "line" | "ink" | "ink2" | "ink3" | "accent" | "check", string>;

/** Bygga's card: its yellow and near black, as the card has always been drawn. */
const BYGGA_C: Colors = { page: "#f5f4f0", card: "#ffffff", line: "#e8e6e0", ink: "#121212", ink2: "#4a4945", ink3: "#8a877f", accent: "#ffd21f", check: "#121212" };

/**
 * The card's colours. Rehber's are its cream, terracotta and warm browns read from its tokens (rehber/tokens.css)
 * as the page computes them, so the picture follows a token change; the values written here are only fallbacks.
 */
function colors(): Colors {
  if (!REHBER) return BYGGA_C;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    page: v("--page", "#f7f1e9"),
    card: v("--card", "#ffffff"),
    line: v("--line", "#eadfd2"),
    ink: v("--ink", "#2d221c"),
    ink2: v("--ink-2", "#5b4a40"),
    ink3: v("--ink-3", "#766459"),
    accent: v("--accent", "#c8643b"),
    // the stamp's check: white on the terracotta, as on the step badge
    check: "#ffffff",
  };
}

/** Weights: rehber loads Nunito in 400, 600, 800 and 900 only, so its lighter lines take the nearest of those. */
const WT = REHBER ? { label: 600, name: 800, variant: 600, stat: 800, brand: 800, tagline: 600 } : { label: 600, name: 800, variant: 500, stat: 700, brand: 800, tagline: 500 };

function font(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** Shrinks text until it fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, family: string, weight: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 4;
  } while (ctx.measureText(text).width > max && s > 40);
}

/** The logo mark: an Allen bolt head seen from above; rehber's is a terracotta rounded square with a cream square turned 45 degrees in it. */
function mark(ctx: CanvasRenderingContext2D, C: Colors, cx: number, cy: number, r: number) {
  if (REHBER) {
    round(ctx, cx - r, cy - r, r * 2, r * 2, (r * 2) / 3);
    ctx.fillStyle = C.accent;
    ctx.fill();
    const k = r * 0.32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    round(ctx, -k, -k, k * 2, k * 2, k * 0.36);
    ctx.lineWidth = r * 0.2;
    ctx.strokeStyle = C.page;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#121212";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const hex = (rr: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  ctx.fillStyle = "#ffd21f";
  hex(r * 0.62);
  ctx.fill();
  ctx.fillStyle = "#121212";
  hex(r * 0.3);
  ctx.fill();
}

/** A 4:5 picture of the finished piece, sized for a post on X or a story. */
export async function buildCard(plan: Plan, key: string, stat: string): Promise<Blob | null> {
  try {
    await document.fonts?.ready;
    const art = await shot(`card:${key}`, plan, { kind: "assembled" }, 900, 760);
    const img = await load(art.url);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const C = colors();
    // rehber sets everything in Nunito (next/font puts it on <html> as --font-nunito)
    const display = font(REHBER ? "--font-nunito" : "--font-display", "system-ui, sans-serif");
    const body = font(REHBER ? "--font-nunito" : "--font-noto", "system-ui, sans-serif");
    // Nunito is not preloaded: make sure the weights drawn here are in before measuring and drawing
    if (REHBER) await Promise.all([...new Set(Object.values(WT))].map((w) => document.fonts?.load(`${w} 40px ${body}`))).catch(() => {});
    const name = displayName(plan.spec.name);

    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, W, H);
    round(ctx, 48, 48, W - 96, H - 96, 56);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.line;
    ctx.stroke();

    // multiply, so the drawing's own white sheet melts into the card instead of showing as a box
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, 90, 96, 900, 760);
    ctx.globalCompositeOperation = "source-over";

    // the stamp: a yellow check, like a finished page in a manual (rehber: a white check on terracotta, no ring)
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(W - 150, 150, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.check;
    if (!REHBER) {
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(W - 176, 152);
    ctx.lineTo(W - 156, 172);
    ctx.lineTo(W - 120, 132);
    ctx.stroke();

    ctx.fillStyle = C.ink3;
    ctx.font = `${WT.label} 30px ${body}`;
    ctx.letterSpacing = "4px";
    ctx.fillText(t("done.cardBuilt"), 110, 950);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = C.ink;
    fit(ctx, name, W - 220, 132, display, WT.name);
    ctx.fillText(name, 104, 1070);
    ctx.fillStyle = C.ink2;
    fit(ctx, plan.spec.variant, W - 220, 42, body, WT.variant);
    ctx.fillText(plan.spec.variant, 110, 1130);

    ctx.fillStyle = C.ink;
    ctx.font = `${WT.stat} 38px ${body}`;
    ctx.fillText(stat, 110, 1206);

    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 1236);
    ctx.lineTo(W - 110, 1236);
    ctx.stroke();
    mark(ctx, C, 134, 1270, 22);
    ctx.fillStyle = C.ink;
    ctx.font = `${WT.brand} 30px ${display}`;
    ctx.fillText(REHBER ? BRAND_INFO.name : "bygga", 168, 1281);
    ctx.fillStyle = C.ink3;
    ctx.font = `${WT.tagline} 26px ${body}`;
    const host = location.host.replace(/^www\./, "");
    ctx.textAlign = "right";
    ctx.fillText(t("done.cardTagline", { host }), W - 110, 1280);
    ctx.textAlign = "left";

    return await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  } catch {
    return null;
  }
}
