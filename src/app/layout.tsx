import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Noto_Sans, Noto_Sans_Display, Nunito } from "next/font/google";
import "./globals.css";
import "./guide.css";
import "./home.css";
import "./scan.css";
// the warm theme (NEXT_PUBLIC_BRAND=rehber): every rule under [data-brand="rehber"], so Bygga's look is untouched
import "./rehber/tokens.css";
import "./rehber/stage.css";
import "./rehber/shell.css";
import "./rehber/panels.css";
import "./rehber/art.css";
import { Analytics } from "@vercel/analytics/next";
import Offline from "@/components/Offline";
import { SITE_URL } from "@/lib/site";
import { LOCALE } from "@/lib/i18n";
import { BRAND, BRAND_INFO } from "@/lib/brand";

const noto = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
  display: "swap",
});

const display = Noto_Sans_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// the warm theme's typeface; not preloaded, so Bygga's own pages don't fetch a font they never use
const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
  preload: false,
});

const description = "Type the product name from the box. Bygga shows every assembly step in 3D, with the parts, screws and tools for each one, and reads it out loud.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BRAND === "rehber" ? BRAND_INFO.name : "Bygga: build IKEA furniture, step by step",
  description,
  applicationName: "Bygga",
  appleWebApp: { capable: true, title: "Bygga", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Bygga", title: "Bygga: build IKEA furniture, step by step", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Bygga: build IKEA furniture, step by step", description },
};

export const viewport: Viewport = {
  themeColor: BRAND_INFO.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={LOCALE} data-brand={BRAND} className={`${noto.variable} ${display.variable}` + (BRAND === "rehber" ? ` ${nunito.variable}` : "")}>
      <body>
        {children}
        <Analytics />
        {/* Plausible, served through our own domain (see the rewrites in next.config.ts) so the CSP stays self-only */}
        <Script src="/pl/script.js" data-domain="usebygga.com" data-api="/pl/event" strategy="afterInteractive" />
        {/* it reads the path, which the prerendered shell doesn't know yet */}
        <Suspense fallback={null}>
          <Offline />
        </Suspense>
      </body>
    </html>
  );
}
