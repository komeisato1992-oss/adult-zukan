import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import type { SnsPostType } from "@/lib/admin/sns-types";

export const SNS_POST_COOLDOWN_DAYS: Partial<Record<SnsPostType, number>> = {
  "recommended-work": 90,
  compare: 180,
  actress: 30,
  genre: 14,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SnsPostReusability = {
  reusable: boolean;
  label: string;
};

export function getPostReusability(
  entry: SnsPostHistoryEntry,
  now = Date.now(),
): SnsPostReusability {
  const cooldownDays = SNS_POST_COOLDOWN_DAYS[entry.postType];
  if (!cooldownDays) {
    return { reusable: true, label: "再利用可" };
  }

  const postedTime = new Date(entry.postedAt).getTime();
  if (Number.isNaN(postedTime)) {
    return { reusable: true, label: "再利用可" };
  }

  const cooldownMs = cooldownDays * MS_PER_DAY;
  const elapsed = now - postedTime;

  if (elapsed >= cooldownMs) {
    return { reusable: true, label: "再利用可" };
  }

  const remainingDays = Math.ceil((cooldownMs - elapsed) / MS_PER_DAY);
  return { reusable: false, label: `あと${remainingDays}日` };
}

const POST_TYPE_LABELS: Record<SnsPostType, string> = {
  "recommended-work": "今日のおすすめ作品",
  compare: "比較投稿",
  actress: "人気女優紹介",
  genre: "ジャンル紹介",
  ranking: "ランキング紹介",
};

export function getPostTypeLabel(postType: SnsPostType): string {
  return POST_TYPE_LABELS[postType];
}

export function getHistoryTargetLabel(entry: SnsPostHistoryEntry): string {
  if (entry.postType === "recommended-work" && entry.contentId) {
    return entry.contentId;
  }

  if (entry.postType === "compare" && entry.compareIds?.length === 2) {
    return `${entry.compareIds[0]} + ${entry.compareIds[1]}`;
  }

  if (entry.postType === "actress" && entry.actressName) {
    return entry.actressName;
  }

  if (entry.postType === "genre" && entry.genreName) {
    return entry.genreName;
  }

  if (entry.postType === "ranking") {
    return "ランキング";
  }

  return "-";
}
