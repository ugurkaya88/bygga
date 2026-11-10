"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Plan, ProductSpec, ToolId } from "@/lib/types";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { stepContents, type StepContents } from "@/lib/plan/contents";
import { matchCatalog, specForKind } from "@/lib/search";
import { KIND_LABELS, type Kind } from "@/lib/products";
import { BREAK_MS, cacheSpec, cachedSpec, getPref, isBuilt, loadProgress, saveProgress, setPref, uncacheSpec, type Phase, type Progress } from "@/lib/store";
import StageView, { type StageHandle } from "../StageView";
import type { StageMode } from "@/engine/stage";
import { LogoMark, Wordmark } from "../Logo";
import { HwArt } from "../art/Hardware";
import { SinkCheck } from "../art/SinkCheck";
import { ScrewCheck, checkScrews } from "../art/ScrewCheck";
import { Helper } from "../art/Helper";
import { ICheck, IClose, IEye, IGrid, IHand, IHelp, IMic, IPause, IPlay, IReplay, IRotate, IScan, ISound, ISoundOff, ISparkle } from "../art/Icons";
import CoverPanel from "./CoverPanel";
import ToolsPanel from "./ToolsPanel";
import BeforePanel from "./BeforePanel";
import PartsPanel from "./PartsPanel";
import StepPanel, { fittingName } from "./StepPanel";
import DonePanel, { Confetti } from "./DonePanel";
import Feedback from "./Feedback";
import HelpSheet from "./HelpSheet";
import Overview from "./Overview";
import Loader from "./Loader";
import Drawing from "../Drawing";
import { haptic, micSupported, primeListening, useListener, useWakeLock, type Mic } from "./hooks";
import { playDone, playStep, playTick, setSound, soundOn } from "./sound";
import { mediaSession, voice } from "./voice";
import { LINES, builtLine, needsLine, spokenAnswer, stepLines, toolsLine, whereLine } from "@/lib/voice/script";
import { hearIntent, type Intent } from "@/lib/voice/commands";
import { useMounted } from "@/lib/useMounted";
import { getUserKey, keyHeaders, useUserKey } from "@/lib/userKey";
import KeyModal, { type KeyTrouble, type KeyWhy } from "../KeyModal";
import { decodeSpec } from "@/lib/scan/share";
import { track } from "@vercel/analytics";
import { SCAN_ENABLED } from "@/lib/site";
import { LOCALE, lower, manualSearchUrl, t, tOr, upper } from "@/lib/i18n";
import { BRAND, BRAND_INFO, displayName } from "@/lib/brand";

/** The spoken lines are English recordings, so the voice is offered only in English for now. */
const VOICE = LOCALE === "en";
/** Whether the guide links out to the rest of the site; rehber's guides keep to themselves. */
const EXITS = BRAND_INFO.exits;
/** rehber's stage corner: a badge with the number and a short muted line beside it, instead of the big numeral. */
const BADGE = BRAND === "rehber";

type Via = "catalog" | "ai" | "guess" | "scan";
/** The cards under the step number over the drawing's top left, each of which can be put away on its own step. */
type Card = "fittings" | "sink" | "length";

export default function GuideApp({ slug, query, step, kind }: { slug: string; query?: string; step?: number; kind?: string }) {
  const router = useRouter();
  const mounted = useMounted();
  const picked = KIND_LABELS.some((k) => k.kind === kind) ? (kind as Kind) : null;
  const isScan = slug.startsWith("scan-");
  const q = query || slug.replace(/-/g, " ");
  const initial = useMemo(() => (isScan ? null : (catalogSpec(slug) ?? (picked ? { ...specForKind(picked, q.split(" ")[0] || q), slug } : null))), [isScan, slug, picked, q]);
  // asked again after a key was added: a typical build gives way to one worked out for this product
  const [attempt, setAttempt] = useState(0);
  // a build saved under this name (an AI draft, a picked shape) wins over a near-miss in the catalog
  const stored = useMemo(() => (mounted && !initial ? (cachedSpec(slug) ?? loadProgress(slug)?.spec ?? null) : null), [mounted, initial, slug, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const match = useMemo(() => (initial || isScan ? null : matchCatalog(q)), [initial, isScan, q]);
  const local = stored ? null : match;
  const [imported, setImported] = useState<{ slug: string; spec: ProductSpec | null } | null>(null);
  const cached = stored ?? (imported?.slug === slug ? imported.spec : null);
  const hash = useMemo(() => (mounted && isScan && location.hash.startsWith("#g=") ? location.hash.slice(3) : ""), [mounted, isScan]);

  // a scanned guide shared as a link carries its own data
  useEffect(() => {
    if (!hash) return;
    let alive = true;
    decodeSpec(hash).then((sp) => {
      if (!alive) return;
      if (sp) cacheSpec(slug, { ...sp, slug });
      setImported({ slug, spec: sp ? { ...sp, slug } : null });
      history.replaceState(null, "", location.pathname + location.search);
    });
    return () => {
      alive = false;
    };
  }, [hash, slug]);
  useEffect(() => {
    if (mounted && local?.slug && local.slug !== slug) router.replace(`/build/${local.slug}` + (step ? `?step=${step}` : ""));
  }, [mounted, local, slug, step, router]);
  const [fetched, setFetched] = useState<{ slug: string; spec?: ProductSpec; via?: Via; suggestions?: string[]; ikea?: string; error?: boolean; trouble?: KeyTrouble } | null>(null);
  // every AI feature runs on the person's own key
  const key = useUserKey();
  const ai = !!key;
  const [askKey, setAskKey] = useState<KeyTrouble | "" | null>(null);
  const again = () => {
    uncacheSpec(slug);
    setFetched(null);
    setAttempt((a) => a + 1);
  };
  const result = fetched?.slug === slug ? fetched : null;
  const spec = initial ?? cached ?? result?.spec ?? null;
  const via: Via = initial ? (initial.source === "guess" ? "guess" : "catalog") : cached ? cached.source : (result?.via ?? "ai");
  const scanGone = isScan && mounted && !cached && (!hash || (imported?.slug === slug && !imported.spec));
  const status = spec ? "ready" : scanGone ? "scangone" : result ? (result.error ? "error" : "notfound") : "loading";
  const suggestions = result?.suggestions ?? [];

  useEffect(() => {
    voice.live = !!key;
  }, [key]);

  // resolve unknown products through the API
  useEffect(() => {
    if (!mounted || initial || cached || local || isScan) return;
    let alive = true;
    fetch("/api/guide", { method: "POST", headers: { "Content-Type": "application/json", ...keyHeaders() }, body: JSON.stringify({ q }) })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.spec) {
          const sp = j.spec as ProductSpec;
          if (j.via === "catalog" && sp.slug && sp.slug !== slug) {
            router.replace(`/build/${sp.slug}` + (step ? `?step=${step}` : ""));
            return;
          }
          sp.slug = slug;
          // a typical build is only a stand-in: not kept, so the next visit (with a key, say) can ask for the real thing
          if (j.via !== "guess") cacheSpec(slug, sp);
          setFetched({ slug, spec: sp, via: j.via, trouble: j.trouble });
        } else setFetched({ slug, suggestions: j.suggestions ?? [], ikea: j.ikea, trouble: j.trouble });
      })
      .catch(() => alive && setFetched({ slug, error: true }));
    return () => {
      alive = false;
    };
  }, [mounted, initial, cached, local, isScan, slug, q, step, router, attempt]);

  const plan = useMemo(() => {
    if (!spec) return null;
    try {
      return buildPlan(spec);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [spec]);

  const draftKey = (
    <AnimatePresence>
      {askKey !== null && (
        <KeyModal
          why="draft"
          name={displayName((spec?.name ?? q.split(" ")[0]).toUpperCase())}
          trouble={askKey || null}
          onClose={() => setAskKey(null)}
          onSaved={() => {
            // with a key, ask again: this time AI works the product out
            setAskKey(null);
            again();
          }}
        />
      )}
    </AnimatePresence>
  );

  if (status === "scangone")
    return (
      <Shell title={t("guide.scannedTitle")}>
        {EXITS ? (
          <div className="notfound">
            <Helper pose="think" bubble="?" size={120} />
            <h1>{t("scanGone.title")}</h1>
            <p className="sub">{SCAN_ENABLED ? t("scanGone.bodyScan") : t("scanGone.body")}</p>
            <Link href={SCAN_ENABLED ? "/scan" : "/"} className="btn primary">
              {SCAN_ENABLED ? t("scanGone.scan") : t("scanGone.search")}
            </Link>
          </div>
        ) : (
          <NoGuide />
        )}
      </Shell>
    );
  if (status === "loading")
    return (
      <Shell title={isScan ? t("guide.scannedTitle") : displayName(upper(q))}>
        <Loader query={isScan ? t("loader.yourGuide") : q} ai={ai} />
      </Shell>
    );
  if (status === "notfound" || status === "error" || !plan)
    return (
      <Shell title={displayName(upper(q))}>
        <NotFound
          query={q}
          slug={slug}
          suggestions={suggestions}
          ikea={result?.ikea}
          error={status === "error"}
          ai={ai}
          trouble={result?.trouble}
          onAddKey={() => setAskKey(result?.trouble ?? "")}
          onRetry={again}
        />
        {draftKey}
      </Shell>
    );
  // a typical build, not yet started, can still be swapped for one worked out with the person's key
  const trouble = result?.trouble;
  const ownSteps =
    via === "guess" && !initial && mounted && !loadProgress(slug)
      ? !ai
        ? { text: t("ownSteps.add", { name: displayName(plan.spec.name) }), act: () => setAskKey("") }
        : trouble === "key"
          ? { text: t("ownSteps.key", { name: displayName(plan.spec.name) }), act: () => setAskKey("key") }
          : trouble === "credits"
            ? { text: t("ownSteps.credits"), act: again }
            : { text: t("ownSteps.retry", { name: displayName(plan.spec.name) }), act: again }
      : undefined;
  return (
    <>
      <Guide key={slug + (picked ?? "")} plan={plan} slug={slug} via={via} ai={ai} startStep={step} onOwnSteps={ownSteps} />
      {draftKey}
    </>
  );
}

/** The top bar's mark: a way home in Bygga; in a brand with no exits, just the mark and the brand's name. */
function HomeMark() {
  if (!EXITS)
    return (
      <span className="home-btn">
        <LogoMark size={34} />
        <Wordmark />
      </span>
    );
  return (
    <Link href="/" className="home-btn" aria-label={t("guide.home")}>
      <LogoMark size={34} />
    </Link>
  );
}

/** A guide that is not here, said plainly with nowhere else to go: rehber's buyers come from the QR code on the box. */
function NoGuide() {
  return (
    <div className="notfound">
      <Helper pose="think" bubble="?" size={120} />
      <h1>{t("nf.title")}</h1>
      <p className="sub">{t("nf.body")}</p>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="guide shell">
      <header className="topbar">
        <HomeMark />
        <div className="tb-title">
          <b>{title}</b>
        </div>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}

function NotFound({
  query,
  slug,
  suggestions,
  ikea,
  error,
  ai,
  trouble,
  onAddKey,
  onRetry,
}: {
  query: string;
  slug: string;
  suggestions: string[];
  ikea?: string;
  error: boolean;
  ai: boolean;
  trouble?: KeyTrouble;
  onAddKey: () => void;
  onRetry: () => void;
}) {
  const name = upper(query.split(" ")[0]);
  const what = ikea ? lower(ikea) : undefined;
  const kinds = KIND_LABELS;
  // with no exits, a failed fetch can only be tried again, and a product we don't know has no catalog to pick from
  if (error && !EXITS)
    return (
      <div className="notfound">
        <Helper pose="think" bubble="!" size={120} />
        <h1>{t("notFound.error")}</h1>
        <p className="sub">{t("notFound.errorBody")}</p>
        <button className="btn primary" onClick={onRetry}>
          {t("error.retry")}
        </button>
      </div>
    );
  if (!EXITS) return <NoGuide />;
  if (error)
    return (
      <div className="notfound">
        <Helper pose="think" bubble="?" size={120} />
        <h1>{t("notFound.error")}</h1>
        <p className="sub">{t("notFound.errorBody")}</p>
        <Link href="/" className="btn primary">
          {t("notFound.searchBack")}
        </Link>
      </div>
    );
  return (
    <div className="notfound wide">
      <div className="nf-head">
        <Helper pose="think" bubble="?" size={96} />
        <div>
          {what ? (
            <>
              <h1>{t("notFound.whatIs", { name, article: /^[aeiou]/.test(what) ? "an" : "a", what })}</h1>
              <p className="sub">
                {t("notFound.whatBody", { what: LOCALE === "tr" ? what : what.replace(/s$/, "") + "s" })}{" "}
                <a href={manualSearchUrl(name)} target="_blank" rel="noreferrer">
                  {t("notFound.whatFind")}
                </a>
                . {t("notFound.whatTail")}
              </p>
            </>
          ) : (
            <>
              <h1>{t("notFound.look", { name })}</h1>
              <p className="sub">{t("notFound.lookBody", { name })}</p>
            </>
          )}
        </div>
      </div>
      {!what && (!ai || trouble) && (
        <div className="nf-ai">
          <ISparkle size={18} />
          <span>
            {trouble === "credits" ? (
              <>
                <b>{t("notFound.creditsLead")}</b>{" "}
                <a href="https://api.together.ai/settings/billing" target="_blank" rel="noreferrer">
                  {t("notFound.creditsLink")}
                </a>{" "}
                {t("notFound.creditsTail", { name })}
              </>
            ) : trouble === "key" ? (
              <>
                <b>{t("notFound.keyLead")}</b> {t("notFound.keyTail", { name })}
              </>
            ) : (
              <>
                <b>{t("notFound.wantLead", { name })}</b> {t("notFound.wantTail")}
              </>
            )}
          </span>
          <button className="btn nf-ai-go" onClick={trouble === "credits" ? onRetry : onAddKey}>
            {trouble === "credits" ? t("notFound.tryAgain") : trouble ? t("notFound.fix") : t("notFound.addKey")}
          </button>
        </div>
      )}
      <div className="kind-grid">
        {kinds.map((k, i) => (
          <motion.div key={k.kind} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
            <Link className="kind-card" href={`/build/${slug}?q=${encodeURIComponent(query)}&kind=${k.kind}`}>
              <Drawing name={"kind-" + k.kind} w={200} h={150} className="kind-thumb" eager />
              <span>{tOr(`kind.${k.kind}`, k.label)}</span>
            </Link>
          </motion.div>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="chips center">
          <span className="muted">{t("notFound.didYouMean")}</span>
          {suggestions.map((s) => (
            <Link key={s} className="chip" href={`/build/${encodeURIComponent(s.toLowerCase().replace(/\s+/g, "-"))}?q=${encodeURIComponent(s)}`}>
              {s}
            </Link>
          ))}
        </div>
      )}
      {SCAN_ENABLED && (
        <Link href="/scan" className="scan-link nf-scan">
          <IScan size={17} />
          <span>
            {t("notFound.notIkea")} <u>{t("notFound.scanManual")}</u>
          </span>
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Guide({ plan, slug, via, ai, startStep, onOwnSteps }: { plan: Plan; slug: string; via: Via; ai: boolean; startStep?: number; onOwnSteps?: { text: string; act: () => void } }) {
  const steps = plan.steps;
  // the manual's notes before step 1 get a screen of their own, between the cover and the tools
  const notes = useMemo(() => plan.spec.custom?.before?.filter((n) => n.title) ?? [], [plan.spec]);
  const first: Phase = notes.length ? "before" : "tools";
  const deep = startStep ? Math.min(startStep, steps.length) - 1 : null;
  const [phase, setPhase] = useState<Phase>(deep !== null ? "steps" : "cover");
  const [step, setStep] = useState(deep ?? 0);
  const [dir, setDir] = useState(1);
  const [tools, setTools] = useState<string[]>([]);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<number | undefined>();
  const [doneAt, setDoneAt] = useState<number | undefined>();
  const [resume, setResume] = useState<Progress | null>(null);
  const [maxStep, setMaxStep] = useState(0);
  const [reached, setReached] = useState(deep !== null ? PHASES.indexOf("steps") : 0);
  const [help, setHelp] = useState<null | { missing?: boolean; ask?: string; at?: number }>(null);
  const [overview, setOverview] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [offer, setOffer] = useState(true);
  const [usedVoice, setUsedVoice] = useState(false);
  const [hl, setHl] = useState<string[] | null>(null);
  const [hover3d, setHover3d] = useState<string | null>(null);
  const [introPlayed, setIntroPlayed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  // the hand button: a plain drag moves the view instead of turning it, from step to step until it is turned off
  const [pan, setPan] = useState(false);
  const [moved, setMoved] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [sound, setSoundState] = useState(true);
  const [seen, setSeen] = useState<number[]>(deep !== null ? [deep] : []);
  const [built, setBuilt] = useState<{ at: number; ms?: number; full?: boolean } | null>(null);
  const [finish, setFinish] = useState<{ ms: number; full: boolean } | null>(null);
  // building time: gaps longer than a break are left out, and so is time on the cover or the done screen
  const clock = useRef({ at: 0, ms: 0, live: false });
  const stage = useRef<StageHandle | null>(null);
  const mounted = useMounted();
  const key = useUserKey();
  const canListen = mounted && ai && micSupported();
  // asking for a key: why, and what to do once there is one
  const [askKey, setAskKey] = useState<{ why: KeyWhy; trouble?: KeyTrouble; then?: "voice" | "tip" } | null>(null);
  // a guide with no recordings (an AI draft) can't be read aloud without a key either
  const [readable, setReadable] = useState(true);
  // bumped after the key modal closes on a key problem (a top-up, say), so listening tries again
  const [listenTry, setListenTry] = useState(0);
  // the corner cards put away, by step, for as long as the guide is open
  const [hiddenCards, setHiddenCards] = useState<Record<number, Card[]>>({});
  // how far the corner cards reach over the drawing (px), measured, so the drawing keeps clear of what is shown
  const [cornerBox, setCornerBox] = useState<{ w: number; h: number } | null>(null);
  const corner = useRef<HTMLDivElement | null>(null);
  // where the keyboard goes once a card is put away or brought back: its own button is gone
  const refocus = useRef<"show" | "hide" | null>(null);
  // the cards' reach as laid out (a card still sliding in counts where it lands), again whenever one comes, goes or resizes
  const watchCorner = useCallback((el: HTMLDivElement | null) => {
    corner.current = el;
    if (!el) return;
    const measure = () => {
      let w = 0, h = 0;
      for (const c of el.children) {
        if (!(c instanceof HTMLElement) || c.classList.contains("num-wrap")) continue;
        // .corner's offsets are from .sheet, which the stage fills
        w = Math.max(w, el.offsetLeft + c.offsetLeft + c.offsetWidth);
        h = Math.max(h, el.offsetTop + c.offsetTop + c.offsetHeight);
      }
      setCornerBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    };
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(el);
      for (const c of el.children) ro.observe(c);
    };
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true });
    watch();
    return () => {
      ro.disconnect();
      mo.disconnect();
      corner.current = null;
    };
  }, []);
  useEffect(() => {
    const to = refocus.current;
    if (!to) return;
    refocus.current = null;
    corner.current?.querySelector<HTMLElement>(to === "show" ? ".cards-show" : ".card-hide")?.focus();
  });

  // restore progress once we are in the browser
  const [restored, setRestored] = useState(false);
  if (mounted && !restored) {
    setRestored(true);
    setSoundState(soundOn());
    setUsedVoice(getPref("voice", false));
    const p = loadProgress(slug);
    // a save made with another shape picked under the same name doesn't fit this plan
    const fits = p && (!p.spec || (p.spec.archetype === plan.spec.archetype && p.spec.variant === plan.spec.variant));
    if (p && fits) {
      setResume(p);
      setTools(p.tools);
      setMissing(new Set(p.missing ?? []));
      setStartedAt(p.startedAt);
      setMaxStep(Math.min(p.step, steps.length - 1));
      setReached(Math.max(deep !== null ? PHASES.indexOf("steps") : 0, PHASES.indexOf(p.phase)));
      setSeen((x) => [...new Set([...(p.seen ?? []), ...x])]);
      if (p.doneAt) setDoneAt(p.doneAt);
      if (isBuilt(p)) setBuilt({ at: p.builtAt ?? p.doneAt ?? p.updatedAt, ms: p.builtMs, full: p.builtFull });
    }
  }
  useEffect(() => {
    if (restored) clock.current = { at: Date.now(), ms: resume?.activeMs ?? 0, live: deep !== null };
    // only once, when the save has been read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  // persist
  useEffect(() => {
    if (!restored || phase === "cover") return;
    saveProgress({
      slug,
      name: plan.spec.name,
      variant: plan.spec.variant,
      category: plan.spec.category,
      minutes: plan.spec.minutes,
      people: plan.spec.people,
      phase,
      step,
      steps: steps.length,
      tools,
      parts: [],
      missing: [...missing],
      startedAt,
      doneAt,
      updatedAt: Date.now(),
      spec: plan.spec.source === "catalog" ? undefined : plan.spec,
      activeMs: clock.current.ms,
      seen,
      builtAt: built?.at,
      builtMs: built?.ms,
      builtFull: built?.full,
    });
  }, [restored, slug, plan, phase, step, tools, missing, startedAt, doneAt, steps.length, seen, built]);

  useWakeLock(phase === "steps" || phase === "parts");

  const go = useCallback((p: Phase, s?: number, d = 1) => {
    const c = clock.current, now = Date.now();
    if (c.live && c.at) c.ms += Math.min(now - c.at, BREAK_MS);
    c.at = now;
    c.live = p !== "cover" && p !== "done";
    setDir(d);
    setPhase(p);
    setReached((r) => Math.max(r, PHASES.indexOf(p)));
    if (s !== undefined) {
      setStep(s);
      setMaxStep((m) => Math.max(m, s));
      if (p === "steps") setSeen((x) => (x.includes(s) ? x : [...x, s]));
    }
    setHl(null);
    setMoved(false);
    if (p === "done") setDoneAt((x) => x ?? Date.now());
    // back on the cover, "Continue at step N" should name where you just were
    if (p === "cover") setResume(loadProgress(slug));
  }, [slug]);

  const showToast = useCallback((text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2600);
  }, []);

  const next = useCallback(() => {
    haptic(12);
    if (phase === "cover") {
      setStartedAt((x) => x ?? Date.now());
      go(first);
    } else if (phase === "before") go("tools");
    else if (phase === "tools") go("parts");
    else if (phase === "parts") go("steps", 0);
    else if (phase === "steps") {
      setStamp((x) => x + 1);
      if (step < steps.length - 1) {
        playStep();
        const n = step + 1;
        const half = Math.floor(steps.length / 2);
        if (steps.length >= 6 && n === half) showToast(t("guide.halfway"));
        else if (n === steps.length - 1 && steps.length >= 4) showToast(t("guide.lastComing"));
        go("steps", n);
      } else {
        playDone();
        go("done");
        const ms = clock.current.ms;
        // skipping through doesn't earn a time: most of the steps have to have been on screen
        const full = new Set([...seen, step]).size >= Math.ceil(steps.length * 0.8);
        setFinish({ ms, full });
        track("built", { product: plan.spec.name, slug, full, minutes: Math.round(ms / 60000) });
        setBuilt((b) => (!b ? { at: Date.now(), ms, full } : full && (!b.full || !b.ms || ms < b.ms) ? { ...b, ms, full } : b));
      }
    }
  }, [phase, step, steps.length, go, showToast, seen, plan.spec.name, slug, first]);

  const back = useCallback(() => {
    if (phase === "before") go("cover", undefined, -1);
    else if (phase === "tools") go(first === "before" ? "before" : "cover", undefined, -1);
    else if (phase === "parts") go("tools", undefined, -1);
    else if (phase === "steps") {
      if (step > 0) go("steps", step - 1, -1);
      else go("parts", undefined, -1);
    } else if (phase === "done") go("steps", steps.length - 1, -1);
  }, [phase, step, steps.length, go, first]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (help || overview || askKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (phase !== "steps" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        // a focused button or link answers its own Enter; holding a key shouldn't race through steps
        if ((t?.tagName === "BUTTON" || t?.tagName === "A") && (e.key === " " || e.key === "Enter")) return;
        if (e.repeat) return;
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!e.repeat) back();
      } else if (e.key.toLowerCase() === "r") stage.current?.replay();
      else if (e.key.toLowerCase() === "h" && !e.repeat) setPan((p) => !p);
      else if (e.key === "?") setHelp({});
      else if (e.key.toLowerCase() === "o") setOverview(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next, back, help, overview, askKey]);

  // the phone's back gesture steps back through the guide instead of leaving it
  const nav = useRef({ phase, back });
  useEffect(() => {
    nav.current = { phase, back };
  });
  const guard = useRef(false);
  const [pops, setPops] = useState(0);
  useEffect(() => {
    if (phase === "cover" || guard.current) return;
    history.pushState({ bygga: "step" }, "");
    guard.current = true;
  }, [phase, pops]);
  useEffect(() => {
    const onPop = () => {
      if (!guard.current) return;
      guard.current = false;
      if (nav.current.phase === "cover") return;
      nav.current.back();
      setPops((n) => n + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* ---------- voice ---------- */

  const said = useRef("");
  const micRef = useRef<Mic>("off");
  const live = useRef({ next, back, step, voiceOn, asking: false });
  useEffect(() => {
    live.current = { next, back, step, voiceOn, asking: !!askKey };
  });
  useEffect(() => voice.subscribe(setSpeaking), []);
  useEffect(() => () => voice.stop(), []);
  useEffect(() => {
    voice.rate = slow ? 0.9 : 1;
  }, [slow]);

  // runs inside the tap or key press, so the browser lets it play sound
  const startVoice = useCallback(() => {
    voice.unlock();
    // read now, not from the render: a key saved a moment ago counts
    const listen = micSupported() && !!getUserKey();
    if (listen) primeListening();
    track("voice_on", { product: plan.spec.name, listen });
    setVoiceOn(true);
    setOffer(false);
    setPref("voice", true);
    said.current = String(step);
    voice.say([LINES.on, ...stepLines(plan, step)]).then((ok) => {
      if (!ok) return;
      // by now the mic has either started or been refused, so the tip matches what works
      const m = micRef.current;
      voice.say([listen && (m === "on" || m === "asking" || m === "off") ? LINES.sayNext : LINES.tapNext]);
    });
  }, [plan, step]);

  // with no key yet, turning the voice on first says what a key adds; once skipped, it just reads for the rest of the visit
  const turnOnVoice = useCallback(() => {
    if (getUserKey() || !micSupported() || skippedKey()) return startVoice();
    // still inside the tap: Safari lets sound start later only if it was unlocked here
    voice.unlock();
    primeListening();
    setAskKey({ why: "voice", then: "voice" });
    voice.readable(stepLines(plan, step)).then(setReadable);
  }, [startVoice, plan, step]);

  const stopVoice = useCallback((confirm = false) => {
    setVoiceOn(false);
    setPref("voice", false);
    if (confirm) voice.say([LINES.off]);
    else voice.stop();
  }, []);

  // read each step as it comes up, and line up the next one
  useEffect(() => {
    if (!voiceOn) return;
    if (phase === "done") {
      if (said.current === "done") return;
      const t = setTimeout(() => {
        said.current = "done";
        voice.say([builtLine(plan)]);
      }, 700);
      return () => clearTimeout(t);
    }
    if (phase !== "steps" || said.current === String(step)) return;
    const t = setTimeout(() => {
      said.current = String(step);
      voice.say(stepLines(plan, step));
    }, 250);
    if (step + 1 < steps.length) voice.prefetch(stepLines(plan, step + 1));
    return () => clearTimeout(t);
  }, [voiceOn, phase, step, plan, steps.length]);

  const run = (intent: Intent) => {
    haptic(10);
    if (intent.kind !== "next") playTick();
    switch (intent.kind) {
      case "next":
        // quiet at once, so it's plain she heard
        voice.stop();
        setHelp(null);
        setOverview(false);
        next();
        break;
      case "back":
        if (step === 0) voice.say([LINES.first]);
        else {
          voice.stop();
          back();
        }
        break;
      case "repeat":
        stage.current?.replay();
        voice.say(stepLines(plan, step));
        break;
      case "replay":
        stage.current?.replay();
        break;
      case "stop":
        voice.stop();
        break;
      case "needs": {
        const tools = toolsLine(plan, step);
        voice.say([needsLine(plan, step) ?? LINES.nothing, ...(tools ? [tools] : [])]);
        break;
      }
      case "where":
        voice.say([whereLine(step, steps.length)]);
        break;
      case "slower":
        setSlow(true);
        voice.rate = 0.9;
        voice.say([LINES.slower]);
        break;
      case "faster":
        setSlow(false);
        voice.rate = 1;
        voice.say([LINES.normal]);
        break;
      case "help":
        voice.stop();
        setHelp({});
        break;
      case "commands":
        voice.say([LINES.commands]);
        break;
      case "off":
        stopVoice(true);
        break;
      case "goto": {
        const n = intent.step === -1 ? steps.length : intent.step;
        if (n >= 1 && n <= steps.length && n - 1 !== step) {
          voice.stop();
          go("steps", n - 1, n - 1 > step ? 1 : -1);
        }
        break;
      }
      case "ask":
        if (!ai) voice.say([LINES.noAnswer]);
        else {
          voice.say([LINES.checking]);
          setHelp((h) => ({ ...h, ask: intent.text, at: Date.now() }));
        }
        break;
    }
  };

  const { mic, heard } = useListener(
    voiceOn && phase === "steps" && canListen,
    `${key}#${listenTry}`,
    (text, seg) => {
      // nothing acts while the key modal is open
      if (askKey) return null;
      // what's left of her in the mic is set aside by when she said it; then "next" anywhere moves on
      const intent = hearIntent(text, seg, voice.linesBetween(seg.start, seg.end), voice.busy || voice.spokeBetween(seg.start, seg.end));
      if (!intent) return null;
      run(intent);
      return intent.kind === "next" ? "next" : text.trim().replace(/[.!?]+$/, "");
    },
    () => voice.busy,
  );

  useEffect(() => {
    micRef.current = mic;
  }, [mic]);

  const speakAnswer = useCallback((text: string) => {
    if (live.current.voiceOn) voice.say(spokenAnswer(text));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!VOICE || e.key.toLowerCase() !== "v" || e.metaKey || e.ctrlKey || e.repeat || phase !== "steps" || help || overview || askKey || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      // the key field opens focused: the "v" mustn't land in it
      e.preventDefault();
      if (voiceOn) stopVoice();
      else turnOnVoice();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, help, overview, askKey, voiceOn, turnOnVoice, stopVoice]);

  // headphone buttons and the lock screen: next track, previous track
  useEffect(() => {
    if (!voiceOn || phase !== "steps") return;
    return mediaSession(
      { title: t("guide.mediaTitle", { n: step + 1, total: steps.length }), artist: displayName(plan.spec.name) },
      {
        next: () => !live.current.asking && live.current.next(),
        back: () => !live.current.asking && live.current.back(),
        play: () => voice.say(stepLines(plan, live.current.step)),
        pause: () => voice.stop(),
      },
    );
  }, [voiceOn, phase, step, steps.length, plan]);

  useEffect(() => {
    const s = plan.spec;
    const name = displayName(s.name);
    // the cover keeps the page's own title; steps and the end say where you are
    document.title =
      phase === "steps"
        ? t("meta.stepTitle", { n: step + 1, total: steps.length, name })
        : phase === "done"
          ? t("meta.doneTitle", { name })
          : t("meta.coverTitle", { name, variant: lower(s.variant) });
  }, [phase, step, steps.length, plan.spec]);

  const mode: StageMode = useMemo(() => {
    if (phase === "cover") return introPlayed || resume ? { kind: "assembled", turntable: true, dims: true } : { kind: "intro", dims: true };
    if (phase === "before" || phase === "tools" || phase === "done") return { kind: "assembled", turntable: true };
    if (phase === "parts") return { kind: "layout" };
    return { kind: "step", index: step };
  }, [phase, step, introPlayed, resume]);

  const highlight = hl ?? (hover3d ? [hover3d] : null);
  const cur = steps[step];
  const contents = phase === "steps" ? stepContents(plan, step) : null;
  const screws = contents && cur?.warnings.includes("length") ? checkScrews(plan, contents.hardware.map((h) => h.type)) : [];
  const cards: Card[] = [];
  if (contents && contents.hardware.length > 0) cards.push("fittings");
  if (contents && cur?.warnings.includes("sink")) cards.push("sink");
  if (screws.length > 0) cards.push("length");
  const hidden = cards.filter((c) => hiddenCards[step]?.includes(c));
  const shown = (c: Card) => cards.includes(c) && !hidden.includes(c);
  const hideCard = (c: Card) => {
    refocus.current = corner.current?.contains(document.activeElement) ? "show" : null;
    setHiddenCards((h) => ({ ...h, [step]: [...(h[step] ?? []), c] }));
  };
  const showCards = () => {
    refocus.current = corner.current?.contains(document.activeElement) ? "hide" : null;
    setHiddenCards((h) => ({ ...h, [step]: [] }));
  };

  const jump = (p: Phase) => {
    if (p === "steps") go("steps", Math.min(maxStep, steps.length - 1), PHASES.indexOf(p) >= PHASES.indexOf(phase) ? 1 : -1);
    else go(p, undefined, PHASES.indexOf(p) >= PHASES.indexOf(phase) ? 1 : -1);
  };

  return (
    <div className="guide" data-phase={phase} data-voice={voiceOn ? "on" : undefined}>
      <header className="topbar">
        <HomeMark />
        <div className="tb-title">
          <b>{displayName(plan.spec.name)}</b>
          <span>{plan.spec.variant}</span>
        </div>
        <Stepper phase={phase} step={step} total={steps.length} reached={reached} onJump={jump} notes={notes.length > 0} />
        <div className="tb-actions">
          {phase === "steps" && (
            <button className="icon-btn" onClick={() => setOverview(true)} aria-label={t("guide.allSteps")} data-tip={t("guide.allSteps")}>
              <IGrid />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
            }}
            aria-pressed={sound}
            aria-label={sound ? t("guide.soundOn") : t("guide.soundOff")}
            data-tip={sound ? t("guide.soundOn") : t("guide.soundOff")}
          >
            {sound ? <ISound /> : <ISoundOff />}
          </button>
          {phase === "steps" && VOICE && (
            <button className={"voice-btn" + (voiceOn ? " on" : "")} onClick={() => (voiceOn ? stopVoice() : turnOnVoice())} aria-pressed={voiceOn} aria-label={voiceOn ? t("guide.voiceTurnOff") : t("guide.voiceTurnOn")} data-tip={t("guide.voiceTip")}>
              <IMic size={18} />
              <span>{voiceOn ? t("guide.voiceOn") : t("guide.voice")}</span>
            </button>
          )}
          <Feedback ctx={{ slug: plan.spec.slug ?? slug, name: plan.spec.name, variant: plan.spec.variant, phase, step: phase === "steps" ? step + 1 : undefined }} />
          <button className="icon-btn" onClick={() => setHelp({})} aria-label={t("guide.help")} data-tip={t("guide.help")}>
            <IHelp />
          </button>
        </div>
      </header>

      <main className="guide-main">
        <section className="sheet" aria-label={t("guide.drawing")}>
          <StageView
            plan={plan}
            mode={mode}
            highlight={highlight}
            paused={paused}
            speed={slow ? 0.5 : 1}
            pan={pan && phase === "steps"}
            options={{ callout: true, interactive: true }}
            onReady={(h) => (stage.current = h)}
            onIntroDone={() => setIntroPlayed(true)}
            onHover={setHover3d}
            onUserView={setMoved}
            corner={phase === "steps" ? cornerBox : null}
          />

          {phase === "steps" && cur && (
            <div className="corner" ref={watchCorner}>
              <div className="num-wrap" aria-hidden="true">
                {BADGE ? (
                  <span className="step-badge">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={step}
                        className="step-badge-n"
                        initial={{ y: 28 * dir, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -28 * dir, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      >
                        {step + 1}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={step}
                      className="big-n"
                      initial={{ y: 46 * dir, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -46 * dir, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    >
                      {step + 1}
                    </motion.span>
                  </AnimatePresence>
                )}
                {BADGE && <CornerOf total={steps.length} parts={contents?.parts ?? []} />}
                {cur.repeat && cur.repeat > 1 && <span className="corner-repeat">{cur.repeat}&times;</span>}
              </div>
              {contents && shown("fittings") && (
                <motion.div key={"hw" + step} className="hw-box corner-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.35 }}>
                  {contents.hardware.slice(0, 4).map(({ type, count }) => (
                    <span key={type.id} className={"hw-box-item" + (highlight?.includes(type.id) ? " lit" : "")} aria-hidden="true">
                      <span className="hw-box-art">
                        <HwArt kind={type.kind} len={type.len} dia={type.dia} fit={40} />
                      </span>
                      <b>{count}&times;</b>
                      <span className="hw-box-name">
                        <span>{fittingName(type)}</span>
                        {type.spec && <small>{type.spec}</small>}
                      </span>
                    </span>
                  ))}
                  <HideCard onHide={() => hideCard("fittings")} />
                </motion.div>
              )}
              {shown("sink") && (
                <motion.div key={"sink" + step} className="sink-box corner-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
                  <SinkCheck width={150} />
                  <HideCard onHide={() => hideCard("sink")} />
                </motion.div>
              )}
              {shown("length") && (
                <motion.div key={"length" + step} className="length-box corner-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
                  <ScrewCheck screws={screws} />
                  <HideCard onHide={() => hideCard("length")} />
                </motion.div>
              )}
              {hidden.length > 0 && (
                <motion.button key={"show" + step} type="button" className="cards-show" onClick={showCards} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <IEye size={15} />
                  {t("guide.showCards")}
                </motion.button>
              )}
            </div>
          )}

          <AnimatePresence>
            {stamp > 0 && phase === "steps" && (
              <motion.span
                key={stamp}
                className="stamp"
                initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                animate={{ scale: [0.3, 1.12, 1], opacity: [0, 1, 1, 0], rotate: 0 }}
                transition={{ duration: 0.85, times: [0, 0.35, 0.6, 1] }}
              >
                <ICheck size={34} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {toast && (
              <motion.div key={toast.id} className="toast" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
                <Helper pose="cheer" size={40} />
                <span>{toast.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "steps" && (
            <div className="stage-ctl">
              <button className="icon-btn float" onClick={() => stage.current?.replay()} aria-label={t("guide.replay")} data-tip={t("guide.replayTip")}>
                <IReplay />
              </button>
              <button className="icon-btn float" onClick={() => setPaused((p) => !p)} aria-label={paused ? t("guide.play") : t("guide.pause")} data-tip={paused ? t("guide.play") : t("guide.pause")}>
                {paused ? <IPlay /> : <IPause />}
              </button>
              <button className={"pill-btn float" + (slow ? " on" : "")} onClick={() => setSlow(!slow)} aria-pressed={slow}>
                {t("guide.slow")}
              </button>
              <button className={"icon-btn float" + (pan ? " on" : "")} onClick={() => setPan(!pan)} aria-pressed={pan} aria-label={t("guide.pan")} data-tip={t("guide.panTip")}>
                <IHand />
              </button>
              <AnimatePresence>
                {moved && (
                  <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="pill-btn float reset-view" onClick={() => stage.current?.resetView()} aria-label={t("guide.resetView")}>
                    <IRotate size={15} /> <span>{t("guide.resetView")}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
          {phase === "steps" && step === 0 && !moved && <span className="drag-hint">{t(pan ? "guide.panHint" : "guide.dragHint")}</span>}
          {phase === "parts" && <span className="sheet-caption">{t("guide.layoutCaption")}</span>}
          {voiceOn && phase === "steps" && (
            <div className="listening" role="status">
              <span className={"eq" + (speaking ? " on" : "")} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="listening-text">
                {!canListen && mounted && micSupported()
                  ? t("listen.reading")
                  : mic === "refused"
                    ? t("listen.refused")
                    : mic === "credits"
                      ? t("listen.credits")
                      : heard
                        ? t("listen.heard", { text: heard })
                        : mic === "on"
                          ? t("listen.on")
                          : mic === "paused"
                            ? t("listen.paused")
                            : mic === "asking"
                              ? t("listen.asking")
                              : mic === "denied"
                                ? t("listen.denied")
                                : mic === "busy"
                                  ? t("listen.busy")
                                  : mic === "nomic"
                                    ? t("listen.nomic")
                                    : mic === "offline"
                                      ? t("listen.offline")
                                      : mic === "unsupported" || !canListen
                                        ? t("listen.unsupported")
                                        : t("listen.starting")}
              </span>
              {((!canListen && mounted && micSupported()) || mic === "refused" || mic === "credits") && (
                <button
                  className="listening-fix"
                  onClick={() => {
                    primeListening();
                    setAskKey(mic === "refused" ? { why: "key", trouble: "key" } : mic === "credits" ? { why: "key", trouble: "credits" } : { why: "voice", then: "tip" });
                  }}
                >
                  {mic === "credits" ? t("listen.topUp") : mic === "refused" ? t("listen.fixKey") : t("listen.turnOn")}
                </button>
              )}
            </div>
          )}
          {(via === "ai" || via === "scan") && phase === "cover" && (
            <span className="sheet-caption ai">
              <ISparkle size={15} /> {via === "scan" ? t("guide.captionScan") : t("guide.captionAi")}
            </span>
          )}
        </section>

        <aside className="panel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              className="panel-inner"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {phase === "cover" && (
                <CoverPanel
                  plan={plan}
                  via={via}
                  resume={resume}
                  built={built}
                  onStart={() => {
                    setMissing(new Set());
                    setStartedAt(Date.now());
                    setDoneAt(undefined);
                    setMaxStep(0);
                    setReached(0);
                    setSeen([]);
                    setFinish(null);
                    clock.current = { at: Date.now(), ms: 0, live: true };
                    go(first);
                  }}
                  onReview={() => go("steps", 0)}
                  onOwnSteps={onOwnSteps}
                  onResume={() => {
                    if (!resume) return;
                    if (resume.phase === "steps") go("steps", Math.min(resume.step, steps.length - 1));
                    else go(resume.phase === "cover" || (resume.phase === "before" && first !== "before") ? first : resume.phase);
                  }}
                />
              )}
              {phase === "before" && <BeforePanel notes={notes} onNext={next} onBack={back} />}
              {phase === "tools" && (
                <ToolsPanel
                  plan={plan}
                  onNext={(have: ToolId[]) => {
                    setTools(have);
                    next();
                  }}
                  onBack={back}
                />
              )}
              {phase === "parts" && (
                <PartsPanel
                  plan={plan}
                  missing={missing}
                  onToggle={(id) => setMissing((s) => toggle(s, id))}
                  onNext={next}
                  onBack={back}
                  onHover={setHl}
                  onMissingHelp={() => setHelp({ missing: true })}
                />
              )}
              {phase === "steps" && (
                <StepPanel
                  plan={plan}
                  index={step}
                  dir={dir}
                  onNext={next}
                  onBack={back}
                  onHover={setHl}
                  offer={VOICE && !voiceOn && offer && (step === 0 || usedVoice) ? { again: usedVoice, listen: canListen || (mounted && micSupported() && !skippedKey()), onStart: turnOnVoice, onDismiss: () => setOffer(false) } : null}
                />
              )}
              {phase === "done" && <DonePanel plan={plan} slug={slug} finish={finish} onReview={back} />}
            </motion.div>
          </AnimatePresence>
        </aside>
      </main>

      {phase === "done" && <Confetti />}
      <p className="sr-only" aria-live="polite">
        {phase === "steps" ? t("guide.srStep", { n: step + 1, total: steps.length, title: cur?.title ?? "", detail: cur?.detail ?? "" }) : phase === "done" ? t("guide.srDone", { name: displayName(plan.spec.name) }) : ""}
      </p>

      <AnimatePresence>
        {help && (
          <HelpSheet
            plan={plan}
            index={phase === "steps" ? step : -1}
            ai={ai}
            focusMissing={help.missing}
            ask={help.ask}
            askId={help.at}
            onAnswer={voiceOn ? speakAnswer : undefined}
            onAddKey={(why, trouble) => setAskKey({ why, trouble })}
            onShow={setHl}
            onGoto={(i) => {
              setHelp(null);
              if (phase !== "steps" || i !== step) go("steps", i, phase !== "steps" || i > step ? 1 : -1);
            }}
            onClose={() => setHelp(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {askKey && (
          <KeyModal
            why={askKey.why}
            trouble={askKey.trouble}
            skip={askKey.then === "voice" && readable ? t("guide.justRead") : undefined}
            onSkip={() => {
              setAskKey(null);
              skipKey();
              startVoice();
            }}
            onClose={() => {
              if (askKey.trouble) setListenTry((n) => n + 1);
              setAskKey(null);
            }}
            onGesture={() => {
              if (!voiceOn) voice.unlock();
              primeListening();
            }}
            onSaved={() => {
              const then = askKey.then;
              setAskKey(null);
              if (then === "voice") startVoice();
              // already reading aloud: now it listens too, and says so when it isn't mid-line
              else if (then === "tip" && !voice.speaking) voice.say([LINES.sayNext]);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {overview && (
          <Overview
            plan={plan}
            current={step}
            doneUpTo={maxStep}
            onPick={(i) => {
              setOverview(false);
              go("steps", i, i >= step ? 1 : -1);
            }}
            onClose={() => setOverview(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const PHASES: Phase[] = ["cover", "before", "tools", "parts", "steps", "done"];

/** The small x on a corner card: puts that card away on this step only. */
function HideCard({ onHide }: { onHide: () => void }) {
  return (
    <button type="button" className="card-hide" onClick={onHide} aria-label={t("guide.hideCard")} title={t("guide.hideCard")}>
      <IClose size={13} strokeWidth={2.6} />
    </button>
  );
}

/** "Just read it aloud" holds for the rest of the visit, so turning the voice on again doesn't ask again. */
const SKIP = "bygga:key-skip";
function skippedKey() {
  try {
    return sessionStorage.getItem(SKIP) === "1";
  } catch {
    return false;
  }
}
function skipKey() {
  try {
    sessionStorage.setItem(SKIP, "1");
  } catch {
    /* storage blocked */
  }
}

function toggle(s: Set<string>, id: string) {
  const n = new Set(s);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  return n;
}

/**
 * The short muted line beside rehber's step badge: "/ 32", and under it the part the step brings in when it brings in
 * one kind of part with a short name (the tinted one in the drawing). Several kinds, or none, leave the count alone.
 */
function CornerOf({ total, parts }: { total: number; parts: StepContents["parts"] }) {
  const one = parts.length === 1 && parts[0].type.name.length <= 24 ? parts[0] : null;
  return (
    <span className="corner-of">
      <b>{t("corner.of", { total })}</b>
      {one && (
        <span>
          {one.count > 1 && <>{one.count}&times; </>}
          {one.type.name}
        </span>
      )}
    </span>
  );
}

/** Where you are: Tools, Parts, Build, Done. Earlier phases can be revisited. */
function Stepper({ phase, step, total, reached, onJump, notes }: { phase: Phase; step: number; total: number; reached: number; onJump: (p: Phase) => void; notes?: boolean }) {
  const items: { id: Phase; label: string }[] = [
    ...(notes ? [{ id: "before" as Phase, label: t("stepper.before") }] : []),
    { id: "tools", label: t("stepper.tools") },
    { id: "parts", label: t("stepper.parts") },
    { id: "steps", label: t("stepper.build") },
    { id: "done", label: t("stepper.done") },
  ];
  const cur = PHASES.indexOf(phase);
  return (
    <nav className="stepper" aria-label={t("stepper.aria")}>
      {items.map((it) => {
        const idx = PHASES.indexOf(it.id);
        const state = idx < cur ? "done" : idx === cur ? "now" : "next";
        const can = idx <= reached && idx !== cur && it.id !== "done";
        const building = it.id === "steps" && phase === "steps";
        return (
          <button key={it.id} className={"stp " + state} data-id={it.id} disabled={!can} onClick={() => onJump(it.id)} aria-current={state === "now" ? "step" : undefined}>
            {it.label}
            {building && (
              <span className="stp-n">
                {step + 1}/{total}
              </span>
            )}
            {state === "now" && (
              <span className="stp-line" aria-hidden="true">
                <motion.i initial={false} animate={{ scaleX: building ? (step + 1) / total : 1 }} transition={{ type: "spring", stiffness: 160, damping: 26 }} />
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
