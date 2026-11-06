import { Suspense } from "react";
import type { Metadata } from "next";
import { catalogSpec } from "@/lib/catalog";
import PrintGuide from "@/components/guide/PrintGuide";
import { lower, t } from "@/lib/i18n";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = catalogSpec(decodeURIComponent((await params).slug));
  const slug = decodeURIComponent((await params).slug);
  return { title: t("meta.printTitle", { name: s ? `${s.name} ${lower(s.variant)}` : t("meta.printFallback") }), robots: { index: false }, alternates: { canonical: `/build/${slug}` } };
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<div className="print-doc" />}>
      <Inner params={params} />
    </Suspense>
  );
}

async function Inner({ params }: Props) {
  const { slug } = await params;
  return <PrintGuide slug={decodeURIComponent(slug)} />;
}
