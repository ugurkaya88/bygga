"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Plan } from "@/lib/types";
import { totals } from "@/lib/plan/contents";
import { POPULAR } from "@/lib/search";
import { buildMinutes, getPref, setPref } from "@/lib/store";
import { Figure } from "../art/Figure";
import { IArrowLeft, IArrowRight, ICheck, ILibrary, IShare } from "../art/Icons";
import Drawing from "../Drawing";
import { LOCALE, fmtMin, t, tn } from "@/lib/i18n";
import { buildCard } from "./shareCard";
import { encodeSpec } from "@/lib/scan/share";
import { track } from "@vercel/analytics";

export default function DonePanel({ plan, slug, finish, onReview }: { plan: Plan; slug: string; finish: { ms: number; full: boolean } | null; onReview: () => void }) {
  const tot = totals(plan);
  const s = plan.spec;
  // a time only counts when the steps were followed, not tapped through in a minute
  const spent = buildMinutes(finish?.ms, finish?.full, s.minutes);
  const faster = spent !== null && spent < s.minutes * 0.95;
  const a = s.archetype;
  const recheck = a === "table" || a === "bed" || a === "seat" || a === "sofa";
  const tall = plan.steps.some((x) => x.kind === "anchor");
  const stat = [spent ? fmtMin(spent) : null, tn("count.steps", plan.steps.length), tn("count.fittings", tot.fittings)].filter(Boolean).join("  \u00b7  ");

  return (
    <div className="pane done">
      <div className="pane-scroll">
        <motion.div className="done-hero" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}>
          <Figure pose="cheer" size={112} bubble="check" className="bounce" />
        </motion.div>
        <motion.h2 className="done-title" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          {t("done.title", { name: s.name })}
        </motion.h2>
        <motion.p className="sub center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {faster ? tn("done.faster", s.minutes - spent!) : spent ? t("done.ownPace") : t("done.allDone")}
        </motion.p>
        <motion.dl className="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div>
            <dt>{spent ? t("done.yourTime") : t("done.typicalTime")}</dt>
            <dd>{fmtMin(spent ?? s.minutes)}</dd>
          </div>
          <div>
            <dt>{t("done.steps")}</dt>
            <dd>{plan.steps.length}</dd>
          </div>
          <div>
            <dt>{t("done.fittings")}</dt>
            <dd>{tot.fittings}</dd>
          </div>
        </motion.dl>

        <ShareCard plan={plan} slug={slug} stat={stat} spent={spent} />

        <Link href="/builds" className="workshop-link">
          <span className="wl-ico">
            <ILibrary size={18} />
          </span>
          <span>
            <b>{t("done.saved")}</b>
            <span>{t("done.savedBody")}</span>
          </span>
          <IArrowRight size={18} />
        </Link>

        <NextUp plan={plan} />
        <Match plan={plan} slug={slug} />

        <h3 className="section-title">{t("done.before")}</h3>
        <ul className="after">
          {tall && (
            <li>
              <ICheck size={16} strokeWidth={2.6} /> {t("done.wallCheck")}
            </li>
          )}
          {recheck && (
            <li>
              <ICheck size={16} strokeWidth={2.6} /> {t("done.retighten")}
            </li>
          )}
          <li>
            <ICheck size={16} strokeWidth={2.6} /> {t("done.spare")}
          </li>
          <li>
            <ICheck size={16} strokeWidth={2.6} /> {t("done.recycle")}
          </li>
        </ul>
      </div>
      <div className="pane-foot">
        <button className="btn round" onClick={onReview} aria-label={t("done.backAria")} data-tip={t("done.backTip")}>
          <IArrowLeft />
        </button>
        <Link className="btn primary big" href="/">
          <span>{t("done.else")}</span>
          <IArrowRight />
        </Link>
      </div>
    </div>
  );
}

/** The picture people post: the finished piece, its name and their time. */
function ShareCard({ plan, slug, stat, spent }: { plan: Plan; slug: string; stat: string; spent: number | null }) {
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    let url = "";
    const t = setTimeout(() => {
      buildCard(plan, slug, stat).then((blob) => {
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, [plan, slug, stat]);

  const share = async () => {
    // scanned guides only exist in this browser, so the link carries the guide itself
    const url = `${location.origin}/build/${slug}` + (plan.spec.source === "scan" ? `#g=${await encodeSpec(plan.spec)}` : "");
    const text = spent ? t("done.shareText", { name: plan.spec.name, time: fmtMin(spent) }) : t("done.shareTextNoTime", { name: plan.spec.name });
    const file = card ? new File([card.blob], `${plan.spec.name.toLowerCase()}-built.png`, { type: "image/png" }) : null;
    track("share", { product: plan.spec.name, image: !!file });
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${text} ${url}` });
      else if (navigator.share) await navigator.share({ title: "Bygga", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <motion.div className="share-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
      <div className={"share-pic" + (card ? " ready" : "")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {card && <img src={card.url} alt={t("done.shareAlt", { name: plan.spec.name })} />}
      </div>
      <div className="share-text">
        <b>{t("done.shareTitle")}</b>
        <span>{t("done.shareBody")}</span>
        <div className="share-actions">
          <button className="btn share-go" onClick={share}>
            {copied ? <ICheck size={17} /> : <IShare size={17} />}
            {copied ? t("done.shareCopied") : t("done.share")}
          </button>
          {card && (
            <a className="btn link small" href={card.url} download={`${plan.spec.name.toLowerCase()}-built.png`}>
              {t("done.saveImage")}
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Other pieces from the same family, or popular builds when there are none. */
function NextUp({ plan }: { plan: Plan }) {
  const s = plan.spec;
  const picks = useMemo(() => {
    const own = (s.siblings ?? []).map((x) => ({ slug: x.slug, name: s.name, label: x.label }));
    // popular builds are IKEA products from the English catalog; a Turkish guide only suggests its own set
    const more = LOCALE === "tr" ? [] : POPULAR.filter((p) => p.name !== s.name).map((p) => ({ slug: p.slug, name: p.name, label: p.category }));
    return [...own, ...more].slice(0, own.length ? Math.min(3, own.length) : 3);
  }, [s]);
  if (!picks.length) return null;
  return (
    <>
      <h3 className="section-title">{s.siblings?.length ? t("done.finishSet", { name: s.name }) : t("done.upNext")}</h3>
      <div className="next-up">
        {picks.map((p) => (
          <Link key={p.slug} href={`/build/${p.slug}`} className="next-card">
            <Drawing name={p.slug} w={200} h={150} className="next-thumb" />
            <span>
              <b>{p.name}</b>
              <span>{p.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

/** "Did this match your box?" Wrong guides get found and fixed this way. */
function Match({ plan, slug }: { plan: Plan; slug: string }) {
  const key = "match:" + slug;
  const [state, setState] = useState<"ask" | "no" | "sent">(() => (getPref(key, false) ? "sent" : "ask"));
  const [step, setStep] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const send = (match: boolean) => {
    setState("sent");
    setPref(key, true);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name: plan.spec.name, variant: plan.spec.variant, match, step: step ?? undefined, note: note || undefined, via: plan.spec.source }),
    }).catch(() => {});
  };
  if (state === "sent")
    return (
      <p className="match-thanks">
        <ICheck size={16} strokeWidth={2.6} /> {t("done.matchThanks")}
      </p>
    );
  return (
    <div className="match">
      <div className="match-q">
        <b>{t("done.matchQ")}</b>
        {state === "ask" && (
          <div className="match-btns">
            <button className="pill-btn" onClick={() => send(true)}>
              {t("common.yes")}
            </button>
            <button className="pill-btn" onClick={() => setState("no")}>
              {t("done.matchNo")}
            </button>
          </div>
        )}
      </div>
      {state === "no" && (
        <motion.div className="match-more" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <span className="muted">{t("done.matchWhich")}</span>
          <div className="match-steps">
            {plan.steps.map((_, i) => (
              <button key={i} className={"step-chip" + (step === i + 1 ? " on" : "")} onClick={() => setStep(step === i + 1 ? null : i + 1)} aria-pressed={step === i + 1}>
                {i + 1}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 400))} placeholder={t("done.matchNote")} rows={2} />
          <button className="btn primary small" onClick={() => send(false)}>
            {t("common.send")}
          </button>
        </motion.div>
      )}
    </div>
  );
}

const PIECES = ["dowel", "screw", "cam", "pin", "nail", "dowel", "screw"];

export function Confetti() {
  const bits = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((i) => {
        const left = (i * 37) % 100;
        const delay = (i % 9) * 0.09;
        const dur = 1.8 + ((i * 13) % 10) / 10;
        const rot = ((i * 71) % 360) - 180;
        const kind = PIECES[i % PIECES.length];
        const yellow = i % 4 === 0;
        return (
          <motion.span
            key={i}
            className="bit"
            style={{ left: `${left}%` }}
            initial={{ y: -40, rotate: 0, opacity: 0 }}
            animate={{ y: "110vh", rotate: rot * 3, opacity: [0, 1, 1, 0] }}
            transition={{ duration: dur, delay, ease: [0.25, 0.1, 0.4, 1] }}
          >
            <Bit kind={kind} yellow={yellow} />
          </motion.span>
        );
      })}
    </div>
  );
}

function Bit({ kind, yellow }: { kind: string; yellow: boolean }) {
  const f = yellow ? "var(--accent)" : "#fff";
  const s = { stroke: "var(--ink)", strokeWidth: 1.6, strokeLinejoin: "round" as const };
  switch (kind) {
    case "dowel":
      return (
        <svg width="28" height="10" viewBox="0 0 28 10">
          <rect x="1" y="1" width="26" height="8" rx="3" fill={yellow ? f : "#f1e2c3"} {...s} />
        </svg>
      );
    case "screw":
      return (
        <svg width="26" height="12" viewBox="0 0 26 12">
          <path d="M4 3.5h17l4 2.5-4 2.5H4z" fill={f} {...s} />
          <rect x="1" y="1" width="3.4" height="10" rx="1.2" fill={f} {...s} />
        </svg>
      );
    case "cam":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="7.5" fill={f} {...s} />
          <path d="M5 7.5l8 3" {...s} strokeWidth={2} />
        </svg>
      );
    case "pin":
      return (
        <svg width="18" height="10" viewBox="0 0 18 10">
          <rect x="1" y="3" width="16" height="4" rx="2" fill={f} {...s} />
          <rect x="7.6" y="1" width="2" height="8" fill={f} {...s} />
        </svg>
      );
    default:
      return (
        <svg width="22" height="8" viewBox="0 0 22 8">
          <path d="M2 3h16l3 1-3 1H2z" fill={f} {...s} />
          <rect x="1" y="1" width="1.4" height="6" fill={f} {...s} />
        </svg>
      );
  }
}
