import "server-only";

import { getBuildStaticGenerationLimit } from "@/lib/dmm/build-static";
import { encodeEntitySlug } from "@/lib/entities/paths";
import { getCatalogWorks } from "@/lib/catalog";

/** ビルド時の静的パラメータ生成を制限（0 なら空配列 → ISR） */
export async function getLimitedWorkStaticParams(): Promise<{ slug: string }[]> {
  const limit = getBuildStaticGenerationLimit();
  if (limit === 0) return [];

  const works = await getCatalogWorks();
  return works.slice(0, limit).map((item) => ({ slug: item.content_id }));
}

export async function getLimitedEncodedEntityStaticParams(
  slugs: string[],
): Promise<{ slug: string }[]> {
  const limit = getBuildStaticGenerationLimit();
  if (limit === 0) return [];

  return slugs.slice(0, limit).map((slug) => ({
    slug: encodeEntitySlug(slug),
  }));
}

export async function getLimitedSlugStaticParams(
  slugs: string[],
): Promise<{ slug: string }[]> {
  const limit = getBuildStaticGenerationLimit();
  if (limit === 0) return [];

  return slugs.slice(0, limit).map((slug) => ({ slug }));
}
