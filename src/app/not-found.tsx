import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Helper } from "@/components/art/Helper";
import { LogoMark, Wordmark } from "@/components/Logo";
import { HeroSearch } from "@/components/home/HomeClient";
import { BRAND_INFO } from "@/lib/brand";
import { t } from "@/lib/i18n";

/** A brand with no exits (rehber) gets a page of its own: its mark, what went wrong, and no links into Bygga's site. */
const MINIMAL = !BRAND_INFO.exits;

export const metadata: Metadata = MINIMAL
  ? { title: `${t("nf.title")} | ${BRAND_INFO.name}`, robots: { index: false } }
  : { title: "Page not found | Bygga", robots: { index: false } };

export default function NotFound() {
  if (MINIMAL)
    return (
      <div className="nf-page">
        <header className="nf-brand">
          <LogoMark size={34} />
          <Wordmark />
        </header>
        <main className="nf-main">
          <Helper pose="think" bubble="?" size={120} />
          <h1>{t("nf.title")}</h1>
          <p>{t("nf.body")}</p>
        </main>
      </div>
    );
  return (
    <div className="site">
      <SiteHeader />
      <main className="lost">
        <Helper pose="think" bubble="?" size={120} />
        <h1>This page isn&apos;t in the box</h1>
        <p className="lead">The link may be old. Type the name from your box instead, or browse every guide.</p>
        <div className="lost-search">
          <HeroSearch />
        </div>
        <Link href="/browse" className="sec-link">
          All guides
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
