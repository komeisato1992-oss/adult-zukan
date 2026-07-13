import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoujinSiteShell } from "@/components/doujin/DoujinSiteShell";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { canAccessDoujinSite } from "@/lib/doujin/access";
import { doujinSiteConfig } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: {
    default: doujinSiteConfig.name,
    template: `%s | ${doujinSiteConfig.name}`,
  },
  description: doujinSiteConfig.description,
  icons: {
    icon: [
      { url: doujinSiteConfig.logoIcon, type: "image/png" },
      { url: doujinSiteConfig.icon, type: "image/png", sizes: "32x32" },
    ],
    shortcut: doujinSiteConfig.logoIcon,
    apple: doujinSiteConfig.appleTouchIcon,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function DoujinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isAdminAuthenticated();
  if (!canAccessDoujinSite({ isAdmin })) {
    notFound();
  }

  return <DoujinSiteShell>{children}</DoujinSiteShell>;
}
