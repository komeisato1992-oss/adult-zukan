export type SnsPostSlot =
  | "07:00"
  | "08:00"
  | "12:00"
  | "18:00"
  | "19:00"
  | "21:00"
  | "23:00";

export type SnsPostType =
  | "recommended-work"
  | "compare"
  | "actress"
  | "genre"
  | "ranking";

export type SnsCompareWorkMini = {
  contentId: string;
  title: string;
  imageUrl?: string;
  actressNames?: string;
  price?: string;
  releaseDate?: string;
  duration?: string;
  genres?: string;
};

export type SnsScheduledPost = {
  slot: SnsPostSlot;
  type: SnsPostType;
  typeLabel: string;
  body: string;
  compareWorks?: [SnsCompareWorkMini, SnsCompareWorkMini];
  compareUrl?: string;
  meta?: SnsPostMeta;
};

export type SnsRankingVariant = "popular" | "new" | "sale" | "random";

export type SnsPostMeta = {
  contentId?: string;
  compareContentIds?: [string, string];
  actressName?: string;
  genreSlug?: string;
  rankingVariant?: SnsRankingVariant;
};

export type SnsScheduleEntry = {
  slot: SnsPostSlot;
  type: SnsPostType;
  typeLabel: string;
};

export const SNS_DAILY_SCHEDULE: SnsScheduleEntry[] = [
  { slot: "07:00", type: "recommended-work", typeLabel: "今日のおすすめ作品" },
  { slot: "08:00", type: "compare", typeLabel: "比較投稿①" },
  { slot: "12:00", type: "actress", typeLabel: "人気女優紹介" },
  { slot: "18:00", type: "genre", typeLabel: "ジャンル紹介" },
  { slot: "19:00", type: "compare", typeLabel: "比較投稿②" },
  { slot: "21:00", type: "ranking", typeLabel: "ランキング紹介" },
  { slot: "23:00", type: "compare", typeLabel: "比較投稿③" },
];
