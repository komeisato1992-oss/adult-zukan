import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { AgeGateProvider } from "@/components/age-gate/AgeGateProvider";
import { SiteShell } from "@/components/layout/SiteShell";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { createRootMetadata } from "@/lib/seo/metadata";
import {
  createOrganizationJsonLd,
  createWebsiteJsonLd,
} from "@/lib/seo/json-ld";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = createRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="flex min-h-screen flex-col bg-white text-foreground antialiased">
        <JsonLd data={[createWebsiteJsonLd(), createOrganizationJsonLd()]} />
        <AgeGateProvider>
          <SiteShell>{children}</SiteShell>
        </AgeGateProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
