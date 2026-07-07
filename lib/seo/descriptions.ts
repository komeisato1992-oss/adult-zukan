/** 説明文を約120文字に収める */
export function truncateDescription(text: string, max = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

type WorkDescriptionInput = {
  title: string;
  description?: string;
  actressNames?: string[];
  makerName?: string;
  price?: string;
};

/** 作品詳細ページ用の description（約120文字） */
export function createWorkDescription({
  title,
  description,
  actressNames = [],
  makerName,
  price,
}: WorkDescriptionInput): string {
  const segments: string[] = [];

  if (description?.trim()) {
    segments.push(description.trim());
  } else {
    segments.push(`「${title}」の作品情報`);
  }

  if (actressNames.length > 0) {
    segments.push(`出演：${actressNames.slice(0, 3).join("、")}`);
  }

  if (makerName) {
    segments.push(`メーカー：${makerName}`);
  }

  if (price) {
    segments.push(`価格：${price}`);
  }

  return truncateDescription(segments.join("。"));
}

type ListDescriptionInput = {
  name: string;
  count?: number;
  context: string;
};

/** 一覧・詳細ページ用の description（約120文字） */
export function createListDescription({
  name,
  count,
  context,
}: ListDescriptionInput): string {
  const countText =
    typeof count === "number" ? `${count}件の作品を掲載。` : "";
  return truncateDescription(`${name}${context}。${countText}品番・価格・出演情報を確認できます。`);
}

/** サイト内検索結果ページ用 */
export function createSearchDescription(query: string, total?: number): string {
  const countText =
    typeof total === "number" && total > 0 ? `${total}件の作品が見つかりました。` : "";
  return truncateDescription(
    `「${query}」の検索結果。${countText}アダルト図鑑で作品・女優・メーカー情報を横断検索できます。`,
  );
}
