"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Helper } from "@/components/art/Helper";
import { LogoMark, Wordmark } from "@/components/Logo";
import { BRAND_INFO } from "@/lib/brand";
import { t } from "@/lib/i18n";

/** Something broke while drawing a page: say so plainly and offer a way out (in rehber, only trying again). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  if (!BRAND_INFO.exits)
    return (
      <div className="nf-page">
        <header className="nf-brand">
          <LogoMark size={34} />
          <Wordmark />
        </header>
        <main className="nf-main">
          <Helper pose="think" bubble="!" size={120} />
          <h1>{t("notFound.error")}</h1>
          <p>{t("error.body")}</p>
          <button className="btn primary" onClick={reset}>
            {t("error.retry")}
          </button>
        </main>
      </div>
    );
  return (
    <main className="lost">
      <Helper pose="think" bubble="!" size={120} />
      <h1>{t("error.title")}</h1>
      <p className="lead">{t("error.body")}</p>
      <div className="lost-actions">
        <button className="btn primary" onClick={reset}>
          {t("error.retry")}
        </button>
        <Link href="/" className="btn ghost">
          {t("error.home")}
        </Link>
      </div>
    </main>
  );
}
