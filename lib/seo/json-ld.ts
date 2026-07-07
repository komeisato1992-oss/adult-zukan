import { siteConfig } from "@/lib/site-config";
import { SITE_URL } from "@/lib/constants";
import type { Work } from "@/data/types";
import type { DmmItem } from "@/lib/dmm/types";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { formatDmmItemPrice } from "@/lib/dmm/release-date";
import { parseDmmPrice } from "@/lib/utils";

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function createWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    description: siteConfig.description,
    url: SITE_URL,
    inLanguage: "ja",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function createOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: SITE_URL,
    description: siteConfig.description,
    logo: `${SITE_URL}/og-default.svg`,
  };
}

export function createBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function createCollectionPageJsonLd(
  name: string,
  description: string,
  url: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: SITE_URL,
    },
  };
}

export function createWorkJsonLd(
  work: Work,
  makerName: string,
  actressNames: string[],
) {
  const price = work.salePrice ?? work.price;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: work.title,
    description: work.description,
    sku: work.productCode,
    image: `${SITE_URL}${work.imageUrl}`,
    brand: {
      "@type": "Brand",
      name: makerName,
    },
    releaseDate: work.releaseDate,
    url: `${SITE_URL}/works/${work.slug}`,
    offers: {
      "@type": "Offer",
      price: price,
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
      url: work.affiliateUrl,
    },
    ...(actressNames.length > 0
      ? {
          actor: actressNames.map((name) => ({
            "@type": "Person",
            name,
          })),
        }
      : {}),
  };
}

export function createDmmProductJsonLd(item: DmmItem) {
  const makerName = getDmmItemMakerName(item);
  const actressNames = getDmmItemActressNameList(item);
  const imageUrl = getDmmItemImageUrl(item);
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  const formattedPrice = formatDmmItemPrice(item);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: item.title,
    sku: item.content_id,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(makerName
      ? {
          brand: {
            "@type": "Brand",
            name: makerName,
          },
        }
      : {}),
    ...(item.date ? { releaseDate: item.date.split(" ")[0] } : {}),
    url: `${SITE_URL}/works/${item.content_id}`,
    ...(formattedPrice
      ? {
          offers: {
            "@type": "Offer",
            price: price || listPrice,
            priceCurrency: "JPY",
            availability: "https://schema.org/InStock",
            url: getDmmFanzaUrl(item),
          },
        }
      : {}),
    ...(actressNames.length > 0
      ? {
          actor: actressNames.map((name) => ({
            "@type": "Person",
            name,
          })),
        }
      : {}),
  };
}

export function createPersonJsonLd(
  name: string,
  description: string,
  url: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description,
    url,
  };
}

export function createItemListJsonLd(
  name: string,
  items: { name: string; url: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function createFaqJsonLd(
  items: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function createArticleJsonLd(article: {
  title: string;
  description: string;
  path: string;
  publishedAt: string;
  updatedAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    url: `${SITE_URL}${article.path}`,
    author: {
      "@type": "Organization",
      name: siteConfig.name,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/og-default.svg`,
      },
    },
    mainEntityOfPage: `${SITE_URL}${article.path}`,
  };
}
