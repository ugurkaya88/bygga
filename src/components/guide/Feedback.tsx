"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { IClose, IFeedback } from "../art/Icons";
import { CheckDot } from "./ui";
import { t } from "@/lib/i18n";

const TOPICS = [
  { id: "looks", label: () => t("fb.looks") },
  { id: "size", label: () => t("fb.size") },
  { id: "steps", label: () => t("fb.steps") },
  { id: "bug", label: () => t("fb.bug") },
  { id: "idea", label: () => t("fb.idea") },
] as const;
type Topic = (typeof TOPICS)[number]["id"];

const hint = (topic: Topic | "none") => {
  switch (topic) {
    case "none":
      return t("fb.hintNone");
    case "looks":
      return t("fb.hintLooks");
    case "size":
      return t("fb.hintSize");
    case "steps":
      return t("fb.hintSteps");
    case "bug":
      return t("fb.hintBug");
    case "idea":
      return t("fb.hintIdea");
  }
};

export interface FeedbackContext {
  slug: string;
  name: string;
  variant: string;
  phase: string;
  /** 1 based, while building */
  step?: number;
}

/**
 * The Feedback button in the guide's top bar. Opens a small card under it (a sheet from the bottom on phones) that
 * sends a topic and a note, with the guide and step it was sent from, to /api/feedback.
 */
export default function Feedback({ ctx, onOpen }: { ctx: FeedbackContext; onOpen?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const toggle = (v: boolean) => {
    setOpen(v);
    onOpen?.(v);
    if (!v) btn.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) toggle(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
    // toggle only reads refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="fb" ref={wrap}>
      <button ref={btn} className={"fb-btn" + (open ? " on" : "")} onClick={() => toggle(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label={t("fb.button")}>
        <IFeedback size={18} />
        <span>{t("fb.buttonText")}</span>
      </button>
      <AnimatePresence>{open && <Card ctx={ctx} onClose={() => toggle(false)} />}</AnimatePresence>
    </div>
  );
}

/** Phones get a sheet from the bottom; anything wider a card under the button. */
function useSheet() {
  const [sheet] = useState(() => typeof window !== "undefined" && matchMedia("(max-width: 640px)").matches);
  return sheet;
}

function Card({ ctx, onClose }: { ctx: FeedbackContext; onClose: () => void }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"edit" | "sending" | "sent" | "failed">("edit");
  const text = useRef<HTMLTextAreaElement>(null);
  const title = useId();
  const sheet = useSheet();
  const ready = (note.trim().length >= 3 || topic !== null) && state !== "sending";

  useEffect(() => {
    // after the card has settled, so the phone's keyboard doesn't push it around mid-animation
    const t = setTimeout(() => text.current?.focus({ preventScroll: true }), 180);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (state !== "sent") return;
    const t = setTimeout(onClose, 1900);
    return () => clearTimeout(t);
  }, [state, onClose]);

  const send = async () => {
    if (!ready) return;
    setState("sending");
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "general",
        slug: ctx.slug,
        name: ctx.name,
        variant: ctx.variant,
        phase: ctx.phase,
        step: ctx.step,
        topic: topic ?? undefined,
        note: note.trim() || undefined,
        email: email.trim() || undefined,
        page: location.pathname + location.search,
      }),
    }).catch(() => null);
    setState(r?.ok ? "sent" : "failed");
  };

  const where = [ctx.name, ctx.variant].filter(Boolean).join(" ");
  const at = ctx.step ? t("step.n", { n: ctx.step }) : { cover: t("fb.atCover"), tools: t("stepper.tools"), parts: t("stepper.parts"), done: t("stepper.done") }[ctx.phase];

  return (
    <>
      <motion.div className="fb-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} aria-hidden="true" />
      <motion.div
        className="fb-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby={title}
        initial={sheet ? { y: "100%" } : { opacity: 0, y: -6, scale: 0.97 }}
        animate={sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        exit={sheet ? { y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
        transition={sheet ? { type: "spring", stiffness: 380, damping: 38 } : { type: "spring", stiffness: 520, damping: 36, mass: 0.7 }}
        onKeyDown={(e) => {
          // the guide's own shortcuts (arrows, R, V, ?) stay out of the card
          e.stopPropagation();
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "sent" ? (
            <motion.div key="sent" className="fb-sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <CheckDot on size={40} />
              <b>{t("fb.sentTitle")}</b>
              <span>{t("fb.sentBody")}</span>
            </motion.div>
          ) : (
            <motion.div key="form" className="fb-form" exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}>
              <div className="fb-head">
                <b id={title}>{t("fb.title")}</b>
                <button className="icon-btn fb-x" onClick={onClose} aria-label={t("common.close")}>
                  <IClose size={18} />
                </button>
              </div>
              <p className="fb-where">
                <span>{where}</span>
                {at && <i>{at}</i>}
              </p>
              <div className="fb-topics" role="radiogroup" aria-label={t("fb.topics")}>
                {TOPICS.map((tp) => (
                  <button key={tp.id} role="radio" aria-checked={topic === tp.id} className={"fb-topic" + (topic === tp.id ? " on" : "")} onClick={() => setTopic(topic === tp.id ? null : tp.id)}>
                    {tp.label()}
                  </button>
                ))}
              </div>
              <textarea ref={text} className="fb-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} placeholder={hint(topic ?? "none")} rows={4} aria-label={t("fb.note")} />
              <input className="fb-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 120))} placeholder={t("fb.emailPlaceholder")} aria-label={t("fb.emailAria")} />
              <div className="fb-foot">
                <span className={"fb-status" + (state === "failed" ? " bad" : "")} aria-live="polite">
                  {state === "failed" ? t("fb.failed") : t("fb.status")}
                </span>
                <button className="btn primary fb-send" onClick={send} disabled={!ready}>
                  {state === "sending" ? <span className="fb-spin" aria-label={t("fb.sending")} /> : t("common.send")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
