import type { Metadata } from "next";
import "./globals.css";
import { Noto_Sans_JP } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AgeGateProvider } from "@/components/age-gate/AgeGateProvider";
import { SiteShell } from "@/components/layout/SiteShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { createRootMetadata } from "@/lib/seo/metadata";
import {
  createOrganizationJsonLd,
  createWebsiteJsonLd,
} from "@/lib/seo/json-ld";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  weight: ["400", "500", "700"],
});

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export const metadata: Metadata = {
  ...createRootMetadata(),
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable} suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col bg-white text-foreground antialiased"
        suppressHydrationWarning
      >
        {gaMeasurementId ? <GoogleAnalytics gaId={gaMeasurementId} /> : null}
        <JsonLd data={[createWebsiteJsonLd(), createOrganizationJsonLd()]} />
        <AgeGateProvider>
          <SiteShell>{children}</SiteShell>
        </AgeGateProvider>
      </body>
    </html>
  );
}
