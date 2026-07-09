import type { Metadata } from "next";
import { normalizeSiteUrl, SITE_URL } from "@/lib/constants";
import { siteConfig } from "@/lib/site-config";

type PageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  canonicalPath?: string;
  ogType?: "website" | "article";
  noIndex?: boolean;
  /** true の場合 title をそのまま使用（サイト名を付与しない） */
  absoluteTitle?: boolean;
  /** OG/Twitter 用画像（相対パスまたは絶対URL） */
  ogImage?: string;
};

function resolveOgImageUrl(ogImage?: string): string {
  if (!ogImage) return normalizeSiteUrl(`${SITE_URL}${siteConfig.ogImage}`);
  if (ogImage.startsWith("http://") || ogImage.startsWith("https://")) {
    return normalizeSiteUrl(ogImage);
  }
  return normalizeSiteUrl(
    `${SITE_URL}${ogImage.startsWith("/") ? ogImage : `/${ogImage}`}`,
  );
}

export function createPageMetadata({
  title,
  description,
  path = "",
  canonicalPath,
  ogType = "website",
  noIndex = false,
  absoluteTitle = false,
  ogImage,
}: PageMetadataOptions): Metadata {
  const url = normalizeSiteUrl(`${SITE_URL}${path}`);
  const canonicalUrl = normalizeSiteUrl(`${SITE_URL}${canonicalPath ?? path}`);
  const resolvedTitle =
    absoluteTitle || path === "" ? title : `${title} | ${siteConfig.name}`;
  const imageUrl = resolveOgImageUrl(ogImage);

  return {
    title: absoluteTitle ? { absolute: resolvedTitle } : resolvedTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: ogType,
      locale: siteConfig.locale,
      url,
      siteName: siteConfig.name,
      title: resolvedTitle,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [imageUrl],
      ...(siteConfig.twitterHandle
        ? { creator: `@${siteConfig.twitterHandle}` }
        : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function createRootMetadata(): Metadata {
  return {
    ...createPageMetadata({
      title: siteConfig.name,
      description: siteConfig.description,
      absoluteTitle: true,
    }),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    keywords: [
      "アダルト",
      "作品",
      "女優",
      "メーカー",
      "ジャンル",
      "図鑑",
      "レビュー",
    ],
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      types: {
        "application/rss+xml": `${SITE_URL}/feed.xml`,
      },
    },
    icons: {
      icon: [
        { url: siteConfig.logoIcon, type: "image/png" },
        { url: "/icon.png", type: "image/png", sizes: "32x32" },
      ],
      shortcut: siteConfig.logoIcon,
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
    appleWebApp: {
      capable: true,
      title: siteConfig.name,
      statusBarStyle: "black-translucent",
    },
    themeColor: siteConfig.accentColor,
  };
}

/** ページネーション付き canonical path を生成 */
export function buildCanonicalPath(
  basePath: string,
  params?: Record<string, string | undefined>,
): string {
  if (!params) return basePath;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
