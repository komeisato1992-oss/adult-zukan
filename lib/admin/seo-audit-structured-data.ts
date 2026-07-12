import "server-only";

import { getCatalogWorks } from "@/lib/catalog";
import { getAllArticles } from "@/data/articles";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { resolveDmmItemDescription } from "@/lib/dmm/resolve-description";
import {
  createArticleJsonLd,
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
  createDmmProductJsonLd,
  createItemListJsonLd,
  createWebsiteJsonLd,
} from "@/lib/seo/json-ld";
import { SITE_URL } from "@/lib/constants";

export type StructuredDataAuditResult = {
  inspectedAt: string;
  sampleSize: number;
  validCount: number;
  validityRate: number;
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateJsonLd(value: unknown): { ok: boolean; detail: string } {
  try {
    const serialized = JSON.stringify(value);
    JSON.parse(serialized);
  } catch {
    return { ok: false, detail: "JSON構文エラー" };
  }

  if (!isPlainObject(value) && !Array.isArray(value)) {
    return { ok: false, detail: "JSON-LDオブジェクトではありません" };
  }

  const nodes = Array.isArray(value) ? value : [value];
  for (const node of nodes) {
    if (!isPlainObject(node)) {
      return { ok: false, detail: "ノードがオブジェクトではありません" };
    }
    if (!node["@type"]) {
      return { ok: false, detail: "@type がありません" };
    }
    if (typeof node.url === "string" && node.url.length > 0) {
      if (!node.url.startsWith(SITE_URL) && !node.url.startsWith("/")) {
        // absolute external is ok for some, but canonical should match site
      }
    }
  }

  return { ok: true, detail: "有効" };
}

export async function runStructuredDataAudit(): Promise<StructuredDataAuditResult> {
  const checks: StructuredDataAuditResult["checks"] = [];
  const catalog = filterDisplayableItems(await getCatalogWorks());
  const sampleWorks = catalog.slice(0, 30);
  const articles = getAllArticles().slice(0, 5);

  const website = createWebsiteJsonLd();
  const websiteCheck = validateJsonLd(website);
  checks.push({
    id: "website",
    label: "WebSite",
    ok: websiteCheck.ok && website["@type"] === "WebSite",
    detail: websiteCheck.ok ? "トップ用 WebSite を生成" : websiteCheck.detail,
  });

  const breadcrumb = createBreadcrumbJsonLd([
    { name: "トップ", path: "/" },
    { name: "作品一覧", path: "/works" },
  ]);
  const breadcrumbCheck = validateJsonLd(breadcrumb);
  checks.push({
    id: "breadcrumb",
    label: "BreadcrumbList",
    ok:
      breadcrumbCheck.ok &&
      breadcrumb["@type"] === "BreadcrumbList" &&
      Array.isArray(breadcrumb.itemListElement),
    detail: breadcrumbCheck.ok
      ? "BreadcrumbList を生成"
      : breadcrumbCheck.detail,
  });

  let workValid = 0;
  for (const item of sampleWorks) {
    const description = await resolveDmmItemDescription(item);
    const jsonLd = createDmmProductJsonLd(item, description);
    const result = validateJsonLd(jsonLd);
    const hasName = typeof jsonLd.name === "string" && jsonLd.name.length > 0;
    const hasUrl =
      typeof jsonLd.url === "string" &&
      jsonLd.url.includes(`/works/${item.content_id}`);
    if (result.ok && hasName && hasUrl) workValid += 1;
  }
  checks.push({
    id: "work-product",
    label: "作品 CreativeWork/Product",
    ok: sampleWorks.length > 0 && workValid === sampleWorks.length,
    detail:
      sampleWorks.length > 0
        ? `作品サンプル ${workValid}/${sampleWorks.length} 件が有効`
        : "作品サンプルなし",
  });

  const collection = createCollectionPageJsonLd(
    "作品一覧",
    "公開作品一覧",
    `${SITE_URL}/works`,
  );
  const collectionCheck = validateJsonLd(collection);
  checks.push({
    id: "collection",
    label: "CollectionPage",
    ok: collectionCheck.ok,
    detail: collectionCheck.detail,
  });

  const itemList = createItemListJsonLd(
    "サンプル作品一覧",
    sampleWorks.slice(0, 5).map((item) => ({
      name: item.title,
      url: `${SITE_URL}/works/${item.content_id}`,
    })),
  );
  const itemListCheck = validateJsonLd(itemList);
  checks.push({
    id: "itemlist",
    label: "ItemList",
    ok: itemListCheck.ok,
    detail: itemListCheck.detail,
  });

  let articleValid = 0;
  for (const article of articles) {
    const jsonLd = createArticleJsonLd({
      title: article.title,
      description: article.description,
      path: `/articles/${article.slug}`,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    });
    const result = validateJsonLd(jsonLd);
    if (result.ok) articleValid += 1;
  }
  checks.push({
    id: "article",
    label: "Article",
    ok: articles.length === 0 ? true : articleValid === articles.length,
    detail:
      articles.length === 0
        ? "記事なし（対象外）"
        : `記事サンプル ${articleValid}/${articles.length} 件が有効`,
  });

  const validCount = checks.filter((check) => check.ok).length;
  return {
    inspectedAt: new Date().toISOString(),
    sampleSize: checks.length + sampleWorks.length + articles.length,
    validCount,
    validityRate: checks.length > 0 ? validCount / checks.length : 0,
    checks,
  };
}
