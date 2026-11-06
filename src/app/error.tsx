"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Figure } from "@/components/art/Figure";
import { t } from "@/lib/i18n";

/** Something broke while drawing a page: say so plainly and offer a way out. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="lost">
      <Figure pose="think" bubble="!" size={120} />
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
