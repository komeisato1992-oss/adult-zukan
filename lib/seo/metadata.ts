import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

type PageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  ogType?: "website" | "article";
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path = "",
  ogType = "website",
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const url = `${siteConfig.url}${path}`;
  const fullTitle = path === "" ? title : `${title} | ${siteConfig.name}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: ogType,
      locale: siteConfig.locale,
      url,
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [siteConfig.ogImage],
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
        "application/rss+xml": `${siteConfig.url}/feed.xml`,
      },
    },
    verification: {
      google: "B5wZE-ISkVIdM4c3JglNJJoZgKFt7wXlK4dASgA_YTQ",
    },
  };
}
