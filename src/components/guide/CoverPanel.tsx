"use client";

import Link from "next/link";
import { spellOut } from "@/lib/shorthand";
import type { Plan } from "@/lib/types";
import { buildMinutes, type Progress } from "@/lib/store";
import { floorSpace, totals } from "@/lib/plan/contents";
import { IArrowRight, IBox, ICheck, IClock, IExternal, IPeople, IPerson, IPrint, IRuler, ISparkle, IWrench } from "../art/Icons";
import { Dots } from "./ui";
import { TOOL_INFO } from "../art/Tools";
import { SCAN_ENABLED } from "@/lib/site";
import { fmtMin as fmtMinutes, lower, manualSearchUrl, shortDate, t, tn, upper } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";

export default function CoverPanel({
  plan,
  via,
  resume,
  built,
  onStart,
  onResume,
  onReview,
  onOwnSteps,
}: {
  plan: Plan;
  via: "catalog" | "ai" | "guess" | "scan";
  resume: Progress | null;
  /** Finished at least once on this device. */
  built?: { at: number; ms?: number; full?: boolean } | null;
  onStart: () => void;
  onResume: () => void;
  onReview: () => void;
  /** A typical build stands in for this product: a key gets it worked out properly. */
  onOwnSteps?: { text: string; act: () => void };
}) {
  const s = plan.spec;
  const tot = totals(plan);
  const resumable = resume && (resume.phase !== "cover" || resume.step > 0) && resume.phase !== "done";
  const official = manualSearchUrl(s.name);
  const tools = plan.tools.filter((x) => !x.optional && !x.included).map((x) => (x.id === "screwdriver" ? t("tool.screwdriver.cover") : TOOL_INFO[x.id].name));
  return (
    <div className="pane cover">
      <div className="pane-scroll">
        <header className="pane-head">
          <p className="eyebrow">{s.brand ? `${s.brand}, ${lower(s.category)}` : s.category}</p>
          <h1 className="product-name">{s.name}</h1>
          <p className="product-variant">{s.variant}</p>
          {built && (
            <p className="built-pill">
              <ICheck size={15} strokeWidth={2.6} />
              {(() => {
                const m = buildMinutes(built.ms, built.full, s.minutes);
                return m ? t("cover.builtIn", { date: shortDate(built.at), time: fmtMinutes(m) }) : t("cover.built", { date: shortDate(built.at) });
              })()}
            </p>
          )}
        </header>

        {s.variants && s.variants.length > 1 && (
          <div className="chips sizes" role="list" aria-label={t("cover.otherSizes")}>
            {chipLabels(s.variants.map((v) => v.label)).map((label, i) => {
              const v = s.variants![i];
              return (
                <Link key={v.slug} href={`/build/${v.slug}`} className={"chip" + (v.slug === s.slug ? " on" : "")} role="listitem" replace>
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        <dl className="stats">
          <div>
            <dt>
              <IClock size={16} /> {t("cover.time")}
            </dt>
            <dd>{fmtMinutes(s.minutes)}</dd>
          </div>
          <div>
            <dt>{s.people === 2 ? <IPeople size={16} /> : <IPerson size={16} />} {t("cover.people")}</dt>
            <dd>{s.people === 2 ? t("cover.peopleTwo") : t("cover.peopleOne")}</dd>
          </div>
          <div>
            <dt>
              <Dots value={s.difficulty} /> {t("cover.level")}
            </dt>
            <dd>{t(`level.${s.difficulty}`)}</dd>
          </div>
        </dl>

        <h3 className="section-title">{t("cover.before")}</h3>
        <ul className="prep">
          <li>
            <span className="prep-ico">
              <IRuler size={18} />
            </span>
            <span>{rich(t("cover.floor", { space: floorSpace(plan) }))}</span>
          </li>
          <li>
            <span className="prep-ico">
              <IBox size={18} />
            </span>
            <span>{rich(t("cover.counts", { panels: tn("count.panels", tot.panels), fittings: tn("count.fittings", tot.fittings), steps: tn("count.steps", plan.steps.length) }))}</span>
          </li>
          {tools.length > 0 && (
            <li>
              <span className="prep-ico">
                <IWrench size={18} />
              </span>
              <span>{rich(t("cover.tools", { tools: lower(tools.join(t("cover.toolsJoin"))) }))}</span>
            </li>
          )}
          {tot.twoAt.length > 0 && s.people === 1 && (
            <li>
              <span className="prep-ico">
                <IPeople size={18} />
              </span>
              <span>{t("cover.helper", { steps: tot.twoAt.slice(0, 2).join(t("cover.helperJoin")) })}</span>
            </li>
          )}
          {s.watchOut?.slice(0, 2).map((w) => (
            <li key={w}>
              <span className="prep-ico">
                <ISparkle size={18} />
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>

        {s.siblings && s.siblings.length > 0 && (
          <>
            <h3 className="section-title">{t("cover.siblings", { name: s.name })}</h3>
            <div className="chips">
              {s.siblings.slice(0, 6).map((v) => (
                <Link key={v.slug} href={`/build/${v.slug}`} className="chip ghost">
                  {v.label}
                </Link>
              ))}
            </div>
          </>
        )}

        {via === "scan" ? (
          <div className="callout note">
            <ISparkle size={18} />
            <div>
              <b>{s.custom?.fromCover ? t("cover.scanCoverTitle") : t("cover.scanMadeTitle")}</b>
              <span>
                {s.custom?.fromCover ? t("cover.scanCoverBody") + (SCAN_ENABLED ? t("cover.scanCoverMore") : t("cover.keepManual")) : t("cover.scanMadeBody")}
              </span>
              {s.custom?.fromCover && SCAN_ENABLED && (
                <Link href="/scan" className="callout-link">
                  {t("cover.scanPages")}
                </Link>
              )}
            </div>
          </div>
        ) : (
          via !== "catalog" && (
            <div className="callout note">
              <ISparkle size={18} />
              <div>
                <b>{via === "ai" ? t("cover.aiTitle") : t("cover.guessTitle")}</b>
                <span>
                  {via === "ai" ? t("cover.aiBody") : t("cover.guessBody")}
                </span>
                {via === "guess" && onOwnSteps && (
                  <button className="callout-link plain" onClick={onOwnSteps.act}>
                    {onOwnSteps.text}
                  </button>
                )}
              </div>
            </div>
          )
        )}
        <div className="cover-links">
          {via !== "scan" && (
            <a className="official" href={official} target="_blank" rel="noreferrer">
              {t("cover.findManual")} <IExternal size={15} />
            </a>
          )}
          <Link className="official" href={`/build/${s.slug}/print`}>
            <IPrint size={15} /> {t("cover.print")}
          </Link>
        </div>
        <p className="cover-note">{t("cover.note")}</p>
      </div>
      <div className="pane-foot">
        {resumable ? (
          <>
            <button className="btn primary big" onClick={onResume}>
              <span>{resume.phase === "steps" ? t("cover.continueAt", { n: resume.step + 1 }) : t("cover.continue")}</span>
              <IArrowRight />
            </button>
            <div className="foot-row center">
              <button className="btn link" onClick={onStart}>
                {t("cover.startAgain")}
              </button>
            </div>
          </>
        ) : built ? (
          <>
            <button className="btn primary big" onClick={onStart} autoFocus>
              <span>{t("cover.buildAnother")}</span>
              <IArrowRight />
            </button>
            <div className="foot-row center">
              <button className="btn link" onClick={onReview}>
                {t("cover.review")}
              </button>
            </div>
          </>
        ) : (
          <button className="btn primary big" onClick={onStart} autoFocus>
            <span>{t("cover.start")}</span>
            <IArrowRight />
          </button>
        )}
      </div>
    </div>
  );
}

function shortVariant(l: string) {
  return l
    .replace(/^[^,]+,\s*/, "")
    .replace(/^chest of /i, "")
    .replace(/^drawer unit, /i, "")
    .replace(/^shoe cabinet with /i, "");
}

/** Chip text per variant: the size, plus whatever sets a variant apart from a twin of the same size (sit/stand, 6 drawers, with storage). */
function chipLabels(labels: string[]) {
  const short = labels.map(shortVariant);
  return labels.map((l, i) => {
    const twins = labels.filter((_, j) => short[j] === short[i]).map((t) => t.split(",")[0].split(" "));
    if (twins.length < 2) return tidy(short[i]);
    const words = l.split(",")[0].split(" ");
    let k = 0;
    while (k < words.length && twins.every((t) => t[k] === words[k])) k++;
    const extra = words
      .slice(k)
      .join(" ")
      .replace(/\//g, t("cover.chipJoin"));
    return tidy(extra && extra !== short[i] ? `${extra}, ${short[i]}` : short[i]);
  });
}


/** IKEA's shorthand spelled out, first letter up. */
function tidy(t: string) {
  const s = spellOut(t)
    // a size never breaks across lines
    .replace(/ × /g, "\u00a0×\u00a0")
    .replace(/(\d) cm\b/g, "$1\u00a0cm");
  return upper(s.charAt(0)) + s.slice(1);
}

/** English only: the workshop page, which is not translated, writes its times with this. The guide uses fmtMin from i18n. */
export function fmtMin(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
