"use client";

import { motion } from "motion/react";
import type { BeforeNote } from "@/lib/types";
import { IAlert, IArrowLeft, IArrowRight, isSafety, WarnIcon } from "../art/Icons";
import { SinkCheck, SinkFlush } from "../art/SinkCheck";
import { t } from "@/lib/i18n";
import { BRAND_INFO } from "@/lib/brand";

/** What the manual's first pages ask the buyer to read before step 1 (CustomParams.before), one card each. */
export default function BeforePanel({ notes, onNext, onBack }: { notes: BeforeNote[]; onNext: () => void; onBack: () => void }) {
  return (
    <div className="pane">
      <div className="pane-scroll">
        <header className="pane-head">
          <p className="eyebrow">{t("before.eyebrow")}</p>
          <h2>{t("before.title")}</h2>
          <p className="sub">{t("before.sub")}</p>
        </header>
        <ul className="before-list">
          {notes.map((n, i) => (
            <motion.li
              key={i}
              className={"before-card" + (n.warn === "sink" ? " wide" : "") + (BRAND_INFO.safetyCards && isSafety(n.warn) ? " safety" : "")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="before-art" aria-hidden="true">
                {n.warn === "sink" ? (
                  <>
                    <SinkCheck width={136} />
                    <SinkFlush width={150} />
                  </>
                ) : n.warn ? (
                  <WarnIcon id={n.warn} size={44} />
                ) : (
                  <span className="before-n">
                    <IAlert size={18} />
                  </span>
                )}
              </span>
              <span className="before-text">
                <b>{n.title}</b>
                {n.text && <span>{n.text}</span>}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="pane-foot">
        <button className="btn round" onClick={onBack} aria-label={t("common.back")}>
          <IArrowLeft />
        </button>
        <button className="btn primary big" onClick={onNext} autoFocus>
          <span>{t("before.go")}</span>
          <IArrowRight />
        </button>
      </div>
    </div>
  );
}
