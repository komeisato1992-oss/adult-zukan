import {
  actressNamesToHashtags,
  buildHashtagLine,
  nameToHashtag,
  SNS_BASE_HASHTAGS,
} from "@/lib/admin/sns-hashtags";
import { buildSnsWorkPostUrl } from "@/lib/admin/sns-urls";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemMakerName,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { getValidImageUrl } from "@/lib/works";

const MAX_POST_LENGTH = 280;
const MAX_ACTRESS_NAMES = 3;

export function normalizeProductCodeInput(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** 作品詳細ページURL（SNS投稿用） */
export function buildWorkDetailUrl(contentId: string): string {
  return buildSnsWorkPostUrl(contentId);
}

type ParsedProductCode = {
  prefix: string;
  num: string;
};

function parseProductCode(value: string): ParsedProductCode | null {
  const normalized = normalizeProductCodeInput(value);
  const match = normalized.match(/^([a-z]+)(\d+)$/);
  if (!match) return null;

  const num = match[2].replace(/^0+/, "") || "0";
  return { prefix: match[1], num };
}

function toCanonicalProductKey(value: string): string | null {
  const parsed = parseProductCode(value);
  if (!parsed) return null;
  return `${parsed.prefix}${parsed.num.padStart(5, "0")}`;
}

function collectQueryKeys(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const keys = new Set<string>([trimmed, normalizeProductCodeInput(trimmed)]);
  const canonical = toCanonicalProductKey(trimmed);
  if (canonical) keys.add(canonical);

  return [...keys];
}

function extractIdFromUrl(url?: string): string[] {
  if (!url?.trim()) return [];

  const ids: string[] = [];
  try {
    const parsed = new URL(url.trim());
    const cid = parsed.searchParams.get("cid");
    if (cid) ids.push(cid);

    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments.at(-1);
    if (last) ids.push(last);
  } catch {
    // ignore invalid URLs
  }

  return ids;
}

function getItemProductSearchKeys(item: DmmItem): string[] {
  const keys = new Set<string>();

  const add = (value?: string) => {
    if (!value?.trim()) return;

    const trimmed = value.trim();
    keys.add(trimmed.toLowerCase());
    keys.add(normalizeProductCodeInput(trimmed));

    const canonical = toCanonicalProductKey(trimmed);
    if (canonical) keys.add(canonical);
  };

  add(item.content_id);
  add(item.product_id);

  for (const id of extractIdFromUrl(item.URL)) add(id);
  for (const id of extractIdFromUrl(item.affiliateURL)) add(id);

  return [...keys];
}

function productCodesMatch(query: string, itemKeys: string[]): boolean {
  const queryKeys = collectQueryKeys(query);
  if (queryKeys.length === 0) return false;

  for (const queryKey of queryKeys) {
    if (itemKeys.includes(queryKey)) return true;
  }

  const queryCanonical = toCanonicalProductKey(query);
  if (!queryCanonical) return false;

  return itemKeys.some((key) => toCanonicalProductKey(key) === queryCanonical);
}

/** catalog内の作品を製品番号で検索 */
export function findWorksByProductCode(
  items: DmmItem[],
  query: string,
): DmmItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matches = new Map<string, DmmItem>();

  for (const item of items) {
    const itemKeys = getItemProductSearchKeys(item);
    if (productCodesMatch(trimmed, itemKeys)) {
      matches.set(item.content_id, item);
    }
  }

  return [...matches.values()];
}

/** 単一検索の別名（複数候補あり得るため findWorksByProductCode を推奨） */
export const findWorkByProductCode = findWorksByProductCode;

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;

  const cut = title.slice(0, maxLength);
  const breakAt = Math.max(
    cut.lastIndexOf("。"),
    cut.lastIndexOf("…"),
    cut.lastIndexOf("、"),
    cut.lastIndexOf(" "),
  );

  if (breakAt > maxLength * 0.5) {
    const sliced = cut.slice(0, breakAt + (cut[breakAt] === " " ? 0 : 1)).trim();
    return `${sliced}…`;
  }

  return `${cut.trimEnd()}…`;
}

function buildOptionalHashtags(item: DmmItem, actressNames: string[]): string[] {
  const tags: string[] = [];
  tags.push(...actressNamesToHashtags(actressNames.join("、")));

  const makerTag = nameToHashtag(getDmmItemMakerName(item) ?? "");
  if (makerTag) tags.push(makerTag);

  const genreName = getDmmItemGenreNameList(item)[0];
  const genreTag = genreName ? nameToHashtag(genreName) : null;
  if (genreTag) tags.push(genreTag);

  return tags;
}

function appendHashtagsWithinLimit(
  bodyWithoutHashtags: string,
  optionalTags: string[],
  maxLength: number,
): string {
  const baseTags = [...SNS_BASE_HASHTAGS];
  let tags = [...baseTags, ...optionalTags];

  while (tags.length >= baseTags.length) {
    const hashtagLine = buildHashtagLine(tags);
    const body = `${bodyWithoutHashtags}\n${hashtagLine}`;

    if (body.length <= maxLength || tags.length === baseTags.length) {
      return body;
    }

    if (tags.length > baseTags.length) {
      tags = tags.slice(0, -1);
      continue;
    }

    return body;
  }

  return bodyWithoutHashtags;
}

/** 280文字以内を意識した「今日のおすすめ作品」投稿文 */
export function generateRecommendedWorkPost(
  item: DmmItem,
  maxLength = MAX_POST_LENGTH,
): string {
  const workUrl = buildWorkDetailUrl(item.content_id);
  const actressList = getDmmItemActressNameList(item).slice(0, MAX_ACTRESS_NAMES);
  const actressLine = actressList.join("、");
  const price = getDmmItemPrice(item);
  const optionalTags = buildOptionalHashtags(item, actressList);

  const header = "【今日のおすすめ作品】✨";
  const footer = ["", "作品ページはこちら👇", workUrl].join("\n");

  let title = item.title;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const lines = [header, "", title];

    if (actressLine) {
      lines.push("", `女優：${actressLine}`);
    }

    if (price) {
      lines.push(`価格：${price}`);
    }

    const bodyWithoutHashtags = `${lines.join("\n")}${footer}`;
    const body = appendHashtagsWithinLimit(
      bodyWithoutHashtags,
      optionalTags,
      maxLength,
    );

    if (body.length <= maxLength) {
      return body;
    }

    const overflow = body.length - maxLength;
    const nextTitleLength = Math.max(16, title.length - overflow - 1);
    title = truncateTitle(item.title, nextTitleLength);
  }

  return appendHashtagsWithinLimit(
    `${header}\n\n${truncateTitle(item.title, 32)}${footer}`,
    [],
    maxLength,
  );
}

export function getRecommendedWorkPreviewImageUrl(
  item: DmmItem,
): string | undefined {
  return getValidImageUrl(item, ["large", "list", "small"]);
}
