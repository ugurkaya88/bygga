import { Suspense } from "react";
import type { Metadata } from "next";
import GuideApp from "@/components/guide/GuideApp";
import { catalogSpec } from "@/lib/catalog";
import { lower, t } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug.startsWith("scan-")) return { title: t("meta.scannedTitle"), robots: { index: false } };
  const s = catalogSpec(decodeURIComponent(slug));
  const name = s ? `${s.name} ${lower(s.variant)}` : decodeURIComponent(slug).replace(/-/g, " ").toUpperCase();
  const title = t("meta.buildTitle", { name });
  const description = s
    ? t("meta.buildDescriptionKnown", { name: `${s.name} ${lower(s.variant)}`, minutes: s.minutes, people: s.people === 2 ? t("meta.buildDescriptionTwo") : "" })
    : t("meta.buildDescriptionOther", { name });
  // a guide that is the same product as another one goes by that one's address
  const url = `/build/${s?.slug ?? slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Bygga", title, description, url },
    twitter: { card: "summary_large_image", title, description },
    // drafts for names we don't know shouldn't fill search results
    robots: s ? undefined : { index: false },
  };
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="guide shell" />}>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const step = typeof sp.step === "string" ? Number(sp.step) : undefined;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  return <GuideApp slug={decodeURIComponent(slug)} query={q} kind={kind} step={step && step > 0 ? Math.floor(step) : undefined} />;
}
