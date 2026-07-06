import { siteConfig } from "@/lib/site-config";
import { SITE_URL } from "@/lib/constants";
import type { Work } from "@/data/types";

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
