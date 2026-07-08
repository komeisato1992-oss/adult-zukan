/** 女優名・ジャンル名などをXハッシュタグ用に正規化 */
export function nameToHashtag(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "-") return null;

  const cleaned = trimmed
    .replace(/[\s　]+/g, "")
    .replace(/[（）()【】[\]「」『』・/／、,]/g, "");

  if (!cleaned) return null;
  return `#${cleaned}`;
}

export function actressNamesToHashtags(names?: string): string[] {
  if (!names?.trim() || names.trim() === "-") return [];

  return names
    .split(/[、,・]/)
    .map((name) => nameToHashtag(name))
    .filter((tag): tag is string => Boolean(tag));
}

export function buildHashtagLine(tags: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const tag of tags) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    unique.push(tag);
  }

  return unique.join(" ");
}

export const SNS_BASE_HASHTAGS = ["#アダルト図鑑", "#FANZA"] as const;

export const SNS_COMPARE_HASHTAGS = [
  "#アダルト図鑑",
  "#比較",
  "#FANZA",
] as const;

export const SNS_RANKING_HASHTAGS = [
  "#アダルト図鑑",
  "#ランキング",
  "#FANZA",
] as const;
