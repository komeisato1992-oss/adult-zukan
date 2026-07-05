import { siteConfig } from "@/lib/site-config";
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
    url: siteConfig.url,
    inLanguage: "ja",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
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
    url: siteConfig.url,
    description: siteConfig.description,
    logo: `${siteConfig.url}/og-default.svg`,
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
      item: `${siteConfig.url}${item.path}`,
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
    image: `${siteConfig.url}${work.imageUrl}`,
    brand: {
      "@type": "Brand",
      name: makerName,
    },
    releaseDate: work.releaseDate,
    url: `${siteConfig.url}/works/${work.slug}`,
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
