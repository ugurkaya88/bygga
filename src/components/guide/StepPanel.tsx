"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Plan, WarnId } from "@/lib/types";
import { stepContents, tipFor } from "@/lib/plan/contents";
import { HwArt } from "../art/Hardware";
import { ToolArt, TOOL_INFO } from "../art/Tools";
import { IArrowLeft, IArrowRight, ICheck, IClock, IClose, IMic, ISparkle, WarnIcon, WARN_TEXT } from "../art/Icons";
import { num, t } from "@/lib/i18n";
import { TwoPeople } from "../art/Figure";
import { SinkCheck } from "../art/SinkCheck";
import Thumb from "../Thumb";
import { getPref, setPref } from "@/lib/store";

export function minutesLeft(plan: Plan, index: number) {
  return plan.steps.slice(index).reduce((s, x) => s + x.minutes, 0);
}

export default function StepPanel({
  plan,
  index,
  dir,
  onNext,
  onBack,
  onHover,
  offer,
}: {
  plan: Plan;
  index: number;
  dir: number;
  onNext: () => void;
  onBack: () => void;
  onHover: (ids: string[] | null) => void;
  /** Invite to turn voice on, while it is off. */
  offer?: { again: boolean; listen: boolean; onStart: () => void; onDismiss: () => void } | null;
}) {
  const s = plan.steps[index];
  const c = stepContents(plan, index);
  const last = index === plan.steps.length - 1;
  const tip = tipFor(plan, index);
  const isBig = (w: WarnId) => w === "two" || w === "tip" || w === "wall";
  const big = s.warnings.filter((w) => isBig(w) && !(w === "wall" && s.warnings.includes("tip")));
  const small = s.warnings.filter((w) => !isBig(w) && w !== "sink");
  const next = plan.steps[index + 1];
  const twoAhead = s.people === 1 ? plan.steps.slice(index + 1, index + 3).findIndex((x) => x.people === 2) : -1;
  const id = plan.spec.name + plan.spec.variant;
  const hasNeeds = c.parts.length + c.hardware.length + s.tools.length > 0;
  const left = minutesLeft(plan, index);

  return (
    <div className="pane step-pane">
      <div className="pane-scroll">
        {offer && (
          <div className="voice-offer">
            <div className="voice-offer-text">
              <b>
                {offer.again ? (
                  t("step.offerAgain")
                ) : (
                  <>
                    {t("step.offerHands")}
                    <span className="vo-more">{t("step.offerTurnOn")}</span>
                  </>
                )}
              </b>
              <span>{offer.listen ? t("step.offerListen") : t("step.offerTap")}</span>
            </div>
            <button className="btn voice-offer-go" onClick={offer.onStart}>
              <IMic size={17} />
              {t("step.offerGo")}
            </button>
            <button className="voice-offer-x" onClick={offer.onDismiss} aria-label={t("step.offerNo")}>
              <IClose size={16} />
            </button>
          </div>
        )}
        <motion.div key={index} initial={{ opacity: 0, x: 22 * dir }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <header className="pane-head">
            <div className="step-meta">
              <span className="eyebrow">{t("step.of", { n: index + 1, total: plan.steps.length })}</span>
              <span className="time-pill" title={t("step.timeLeftTitle")}>
                <IClock size={14} /> {left < 60 ? t("step.minLeft", { n: left }) : t("step.hLeft", { n: num(Math.round(left / 6) / 10) })}
              </span>
            </div>
            <h2 className="step-title">{s.title}</h2>
            {s.detail && <p className="sub">{s.detail}</p>}
            {s.sub && s.sub.length > 0 && (
              <ol className="substeps">
                {s.sub.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            )}
          </header>

          {s.repeat && s.repeat > 1 && (
            <div className="callout repeat">
              <span className="repeat-badge">{s.repeat}&times;</span>
              <span>
                {t(plan.spec.archetype === "drawers" ? "step.repeatDrawers" : "step.repeatOther", { n: s.repeat })}
              </span>
            </div>
          )}

          {big.map((w) => (
            <div key={w} className={"callout warn " + w}>
              {w === "two" ? <TwoPeople size={36} /> : <WarnIcon id={w} size={36} />}
              <div>
                <b>{w === "two" ? t("warn.twoTitle") : w === "tip" ? t("warn.tipTitle") : t("warn.wallTitle")}</b>
                <span>{w === "two" ? t("warn.twoBody") : w === "tip" ? t("warn.tipBody") : t("warn.wallBody")}</span>
              </div>
            </div>
          ))}

          {s.warnings.includes("sink") && (
            <div className="callout sink">
              <SinkCheck className="sink-art" />
              <div>
                <b>{t("warn.sinkTitle")}</b>
                <span>{t("warn.sinkBody")}</span>
              </div>
            </div>
          )}

          {hasNeeds && (
            <>
              <h3 className="section-title">{t("step.need")}</h3>
              <ul className="needs">
                {c.parts.map(({ type, count }) => (
                  <li key={type.id} onMouseEnter={() => onHover([type.id])} onMouseLeave={() => onHover(null)}>
                    <Thumb id={id} plan={plan} mode={{ kind: "part", ref: type.id }} w={96} h={68} className="need-thumb" />
                    <span className="letter sm">{type.label}</span>
                    <span className="need-name">{type.name}</span>
                    <span className="need-qty">{count}&times;</span>
                  </li>
                ))}
                {c.hardware.map(({ type, count }) => (
                  <li key={type.id} onMouseEnter={() => onHover([type.id])} onMouseLeave={() => onHover(null)}>
                    <span className="need-art">
                      <HwArt kind={type.kind} len={type.len} dia={type.dia} fit={40} />
                    </span>
                    <span className="need-name">
                      {type.notIncluded ? (type.kind === "plug" ? t("step.wallPlug") : t("step.wallScrew")) : type.name}
                      {type.spec && <small>{type.spec}</small>}
                    </span>
                    <span className="need-qty">{count}&times;</span>
                  </li>
                ))}
                {s.tools.map((tool) => (
                  <li key={tool} className="tool">
                    <span className="need-art">
                      <ToolArt id={tool} size={40} />
                    </span>
                    <span className="need-name">{TOOL_INFO[tool].name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {small.length > 0 && (
            <div className="warn-row">
              {small.map((w) => (
                <span key={w} className="warn-chip">
                  <WarnIcon id={w} size={24} />
                  {WARN_TEXT[w]}
                </span>
              ))}
            </div>
          )}

          {tip && (
            <div className="callout tip">
              <ISparkle size={18} />
              <span>{tip}</span>
            </div>
          )}

          {twoAhead >= 0 && (
            <p className="heads-up">
              <TwoPeople size={22} /> {t("step.headsUp", { n: index + 2 + twoAhead })}
            </p>
          )}

          {next ? (
            <button className="upnext" onClick={onNext}>
              <span className="upnext-label">{t("step.upNext")}</span>
              <span className="upnext-body">
                <Thumb id={id} plan={plan} mode={{ kind: "step", index: index + 1 }} w={150} h={110} className="upnext-thumb" />
                <span className="upnext-text">
                  <b>{index + 2}</b>
                  <span>{next.title}</span>
                </span>
                <IArrowRight size={18} />
              </span>
            </button>
          ) : (
            <div className="upnext final">
              <span className="upnext-label">{t("step.lastStep")}</span>
              <span className="upnext-body">
                <span className="upnext-text">
                  <span>{t("step.afterThis")}</span>
                </span>
              </span>
            </div>
          )}
        </motion.div>
      </div>
      <div className="pane-foot">
        <KeysTip />
        <button className="btn round" onClick={onBack} aria-label={t("step.prev")} title={t("step.prevTitle")}>
          <IArrowLeft />
        </button>
        <button className="btn primary big done-btn" onClick={onNext} title={t("step.nextTitle")}>
          <span className="done-ico">
            <ICheck size={18} strokeWidth={2.8} />
          </span>
          <span className="done-label">{last ? t("step.finish") : t("step.next")}</span>
          <IArrowRight />
        </button>
      </div>
    </div>
  );
}

/**
 * The keyboard shortcuts, once: a tip over the Done button on a first visit
 * with a keyboard and mouse. Closing it, or using the keys, puts it away for good.
 */
function KeysTip() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (getPref("keysTip", false) || !matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)").matches) return;
    const t = setTimeout(() => setShow(true), 1200);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !(e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key.toLowerCase() === "r")) return;
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
      setPref("keysTip", true);
      setShow(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="keys-tip" role="note" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ type: "spring", stiffness: 460, damping: 32 }}>
          <span>
            <kbd aria-label={t("step.keysLeft")}>&larr;</kbd>
            <kbd aria-label={t("step.keysRight")}>&rarr;</kbd>
            {t("step.keysMove")}
          </span>
          <span>
            <kbd>R</kbd>
            {t("step.keysReplay")}
          </span>
          <button
            className="keys-tip-x"
            onClick={() => {
              setPref("keysTip", true);
              setShow(false);
            }}
            aria-label={t("step.keysHide")}
          >
            <IClose size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The manuals' check for which face goes out: a countersunk hole (right) beside a plain one (wrong). */
