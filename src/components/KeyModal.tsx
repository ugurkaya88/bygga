"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Helper } from "./art/Helper";
import { ICamera, ICheck, IClose, IExternal, IImage, IKey, ILock, IMic, IVolume, IWand } from "./art/Icons";
import { KEY_URL, setUserKey, useUserKey } from "@/lib/userKey";
import { t } from "@/lib/i18n";

/** What brought the person here: the modal leads with that. "key" is for checking or changing a saved key. */
export type KeyWhy = "voice" | "ask" | "photo" | "draft" | "key";
/** A key Together turned away, or an account out of credit. */
export type KeyTrouble = "key" | "credits";

const BILLING_URL = "https://api.together.ai/settings/billing";

const FEATURES = {
  next: { icon: IMic, b: t("key.nextB"), rest: t("key.nextRest") },
  ask: { icon: IVolume, b: t("key.askB"), rest: t("key.askRest") },
  see: { icon: IImage, b: t("key.seeB"), rest: t("key.seeRest") },
  photo: { icon: ICamera, b: t("key.photoB"), rest: t("key.photoRest") },
  draft: { icon: IWand, b: t("key.draftB"), rest: t("key.draftRest") },
};

const COPY: Record<KeyWhy, { title: (name?: string) => string; bubble: string; features: (keyof typeof FEATURES)[] }> = {
  voice: { title: () => t("key.voiceTitle"), bubble: t("key.voiceBubble"), features: ["next", "ask", "see"] },
  ask: { title: () => t("key.askTitle"), bubble: t("key.askBubble"), features: ["ask", "see", "next"] },
  photo: { title: () => t("key.photoTitle"), bubble: t("key.photoBubble"), features: ["photo", "ask", "next"] },
  draft: { title: (name) => (name ? t("key.draftTitle", { name }) : t("key.draftTitleAny")), bubble: t("key.draftBubble"), features: ["draft", "next", "ask"] },
  key: { title: () => t("key.keyTitle"), bubble: t("key.keyBubble"), features: ["next", "ask", "see"] },
};

/**
 * Asks for the person's own Together AI key, which every AI feature runs on:
 * what it unlocks, what it costs (about a cent a build) and where to get one.
 * Their key stays in this browser.
 */
export default function KeyModal({
  why,
  name,
  trouble,
  skip,
  onSkip,
  onClose,
  onSaved,
  onGesture,
}: {
  why: KeyWhy;
  /** The product, for "draft". */
  name?: string;
  trouble?: KeyTrouble | null;
  /** The quiet way out, e.g. "Just read it aloud", and what it does (closing, unless given). */
  skip?: string;
  onSkip?: () => void;
  /** Closed with no new key. */
  onClose: () => void;
  /** A working key was saved. */
  onSaved?: () => void;
  /** Runs inside the tap on Save, before anything waits: lets the guide start audio, which Safari only allows from a tap. */
  onGesture?: () => void;
}) {
  const key = useUserKey();
  const copy = COPY[why];
  const [editing, setEditing] = useState(!key || trouble === "key");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "bad" | "busy" | "saved">("idle");
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  // closed while a key was still being checked: it isn't saved, and nothing starts
  const gone = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const close = () => {
    gone.current = true;
    onClose();
  };
  useEffect(() => {
    // set again on mount: React can mount a component twice in development
    gone.current = false;
    return () => {
      gone.current = true;
      clearTimeout(timer.current);
    };
  }, []);

  // keyboards start inside; on phones the field waits for a tap so the keyboard doesn't cover what it's for
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (fine && input.current) input.current.focus({ preventScroll: true });
    else box.current?.focus({ preventScroll: true });
    return () => back?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // closes this alone, not the help sheet or guide behind it
        e.preventDefault();
        e.stopImmediatePropagation();
        gone.current = true;
        onClose();
      } else if (e.key === "Tab" && box.current) {
        // focus stays inside while it's open
        const all = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input")];
        if (!all.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function save(value = draft) {
    const k = value.trim();
    if (!k || state === "checking" || done.current) return;
    onGesture?.();
    setState("checking");
    let reason = "";
    try {
      const r = await fetch("/api/key", { method: "POST", headers: { "x-together-key": k } });
      const j = (await r.json()) as { ok: boolean; reason?: string };
      // a check that couldn't run doesn't block the key: it's tried for real on first use
      reason = j.ok || j.reason === "unavailable" ? "" : (j.reason ?? "rejected");
    } catch {
      reason = "";
    }
    if (gone.current) return;
    if (reason) {
      setState(reason === "busy" ? "busy" : "bad");
      input.current?.focus();
      return;
    }
    done.current = true;
    setUserKey(k);
    setState("saved");
    // a beat to see "Saved"; closed in that beat, the key stays saved but nothing else starts
    timer.current = setTimeout(() => !gone.current && (onSaved ?? onClose)(), 650);
  }

  const bad = state === "bad" || state === "busy";
  const help =
    state === "bad"
      ? t("key.helpBad")
      : state === "busy"
        ? t("key.helpBusy")
        : trouble === "key" && !draft
      ? t("key.helpTrouble")
      : null;

  // on the body, so nothing it's opened from (a moving search box, a sheet) can clip or shift it
  return createPortal(
    <motion.div className="key-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.16 } }} onClick={close}>
      <motion.div
        ref={box}
        tabIndex={-1}
        className="key-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="key-x" onClick={close} aria-label={t("common.close")}>
          <IClose size={18} />
        </button>

        <div className="key-hero" aria-hidden="true">
          <Helper pose="wave" size={92} />
          <span className="key-bubble">{copy.bubble}</span>
          <span className="key-tag">
            <IKey size={15} />
          </span>
        </div>

        <h2 id="key-title">{copy.title(name)}</h2>
        <p className="key-sub">{t("key.sub")}</p>

        <ul className="key-feats">
          {copy.features.map((f) => {
            const { icon: Icon, b, rest } = FEATURES[f];
            return (
              <li key={f}>
                <span className="key-feat-ico">
                  <Icon size={17} />
                </span>
                <span>
                  <b>{b}</b> {rest}
                </span>
              </li>
            );
          })}
        </ul>

        {trouble === "credits" ? (
          <div className="key-cost out">
            <span className="key-cent">$0</span>
            <span>
              <b>{t("key.creditsLead")}</b>
              <a href={BILLING_URL} target="_blank" rel="noreferrer">
                {t("help.addCredit")} <IExternal size={12} />
              </a>
              {t("key.creditsTail")}
            </span>
          </div>
        ) : (
          <div className="key-cost">
            <span className="key-cent">1¢</span>
            <span>
              <b>{t("key.costLead")}</b>{t("key.costTail")}
            </span>
          </div>
        )}

        {!editing && key ? (
          <div className="key-have">
            <span className="key-have-ico">{state === "saved" ? <ICheck size={17} strokeWidth={2.6} /> : <IKey size={17} />}</span>
            <span className="key-have-text">
              <b>{t("key.saved")}</b>
              <span>{t("key.ending", { tail: key.slice(-4) })}</span>
            </span>
            <button
              className="link-btn"
              onClick={() => {
                setEditing(true);
                setTimeout(() => input.current?.focus(), 30);
              }}
            >
              {t("key.change")}
            </button>
            <button className="link-btn" onClick={() => setUserKey("")}>
              {t("key.remove")}
            </button>
          </div>
        ) : (
          <form
            className={"key-form" + (bad ? " bad" : "") + (state === "saved" ? " saved" : "")}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="key-input">
              <IKey size={17} />
              <input
                ref={input}
                type="password"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (bad) setState("idle");
                }}
                // a pasted key is the whole key: no need to also press Save
                onPaste={(e) => {
                  const v = e.clipboardData.getData("text").trim();
                  if (v.length < 20) return;
                  e.preventDefault();
                  setDraft(v);
                  save(v);
                }}
                placeholder={t("key.placeholder")}
                aria-label={t("key.aria")}
                aria-invalid={bad}
                aria-describedby="key-help"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
              />
            </label>
            <button className="btn primary key-save" type="submit" disabled={!draft.trim() || state === "checking" || state === "saved"}>
              {state === "saved" ? (
                <>
                  <ICheck size={17} strokeWidth={2.8} /> {t("key.savedBtn")}
                </>
              ) : state === "checking" ? (
                t("key.checking")
              ) : (
                t("key.save")
              )}
            </button>
          </form>
        )}

        <p id="key-help" className={"key-help" + (help ? " bad" : "")} role={help ? "alert" : undefined}>
          {help ?? (
            <>
              {t("key.noKey")}{" "}
              <a href={KEY_URL} target="_blank" rel="noreferrer">
                {t("key.make")} <IExternal size={12} />
              </a>
            </>
          )}
        </p>
        <p className="key-safe">
          <ILock size={13} /> {t("key.safe")}
        </p>

        {skip && (
          <button
            className="key-skip"
            onClick={() => {
              gone.current = true;
              (onSkip ?? onClose)();
            }}
          >
            {skip}
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
