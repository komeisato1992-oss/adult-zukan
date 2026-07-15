import Link from "next/link";
import Image from "next/image";
import { WorkCard } from "@/components/ui/WorkCard";
import { RankingWorkCard } from "@/components/ranking/RankingWorkCard";
import { PersonImagePlaceholder } from "@/components/ui/PersonImagePlaceholder";
import { imageCoverClassName } from "@/components/ui/image-cover";
import type { Work } from "@/data/types";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";
import type {
  RankedActressEntity,
  RankedMakerEntity,
  RankedSeriesEntity,
} from "@/lib/ranking/entity-ranking";
import { isValidImageUrl } from "@/lib/works";
import { WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";

type RankedWorkListProps = {
  works: Work[];
  showRank?: boolean;
};

export function RankedWorkList({ works, showRank = true }: RankedWorkListProps) {
  return (
    <ol className={WORK_LIST_GRID_CLASSNAME}>
      {works.map((work, index) => (
        <li key={work.slug} className="relative">
          {showRank && (
            <span className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow">
              {index + 1}
            </span>
          )}
          <WorkCard work={work} />
        </li>
      ))}
    </ol>
  );
}

type DmmRankedWorkListProps = {
  items: WorkListCardItem[];
  showRank?: boolean;
};

export function DmmRankedWorkList({
  items,
  showRank = true,
}: DmmRankedWorkListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ol className={WORK_LIST_GRID_CLASSNAME}>
      {items.map((item, index) => (
        <li key={item.contentId} className="relative">
          {showRank && (
            <span className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow">
              {index + 1}
            </span>
          )}
          <RankingWorkCard item={item} />
        </li>
      ))}
    </ol>
  );
}

export function RankingEmptyState({
  message = "ランキングデータを集計中です",
}: {
  message?: string;
}) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
      {message}
    </p>
  );
}

type RankedActressListProps = {
  actresses: RankedActressEntity[];
  showRank?: boolean;
  showScore?: boolean;
};

export function RankedActressList({
  actresses,
  showRank = true,
  showScore = false,
}: RankedActressListProps) {
  if (actresses.length === 0) {
    return <RankingEmptyState message="表示できるランキングデータがありません" />;
  }

  return (
    <ol className="grid grid-cols-2 gap-2.5 min-[769px]:gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {actresses.map((actress, index) => (
        <li key={actress.slug} className="relative">
          <Link
            href={actress.href}
            className="group block overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-surface">
              {showRank ? (
                <span className="absolute left-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                  {index + 1}
                </span>
              ) : null}
              {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
                <Image
                  src={actress.imageUrl}
                  alt={actress.name}
                  fill
                  className="object-cover object-[right_center]"
                  sizes="(max-width:640px) 50vw, 160px"
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <PersonImagePlaceholder name={actress.name} className="h-full" />
              )}
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {actress.name}
              </h3>
              <p className="mt-1 text-xs text-muted">
                出演作品 {actress.workCount}件
              </p>
              {showScore ? (
                <p className="mt-1 text-[11px] text-muted">
                  score {actress.score} / 人気合計{" "}
                  {actress.breakdown.workPopularityScoreSum} / 新作{" "}
                  {actress.breakdown.recentNewCount}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

type RankedEntityCard = {
  name: string;
  href: string;
  meta: string;
  imageUrl?: string;
  scoreDetail?: string;
};

type RankedEntityListProps = {
  items: RankedEntityCard[];
  emptyMessage?: string;
};

export function RankedEntityList({
  items,
  emptyMessage = "表示できるランキングデータがありません",
}: RankedEntityListProps) {
  if (items.length === 0) {
    return <RankingEmptyState message={emptyMessage} />;
  }

  return (
    <ol className="divide-y divide-border rounded-lg border border-border bg-white">
      {items.map((item, index) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
              {index + 1}
            </span>
            {isValidImageUrl(item.imageUrl) && item.imageUrl ? (
              <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-surface">
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  className={imageCoverClassName}
                  sizes="36px"
                  unoptimized
                />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{item.name}</p>
              <p className="text-xs text-muted">{item.meta}</p>
              {item.scoreDetail ? (
                <p className="text-[11px] text-muted">{item.scoreDetail}</p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function toMakerEntityCards(
  items: RankedMakerEntity[],
  showScore = false,
): RankedEntityCard[] {
  return items.map((item) => ({
    name: item.name,
    href: item.href,
    meta: `${item.workCount}作品`,
    imageUrl: item.imageUrl,
    scoreDetail: showScore
      ? `score ${item.score} / 人気合計 ${item.breakdown.workPopularityScoreSum} / 新作 ${item.breakdown.recentNewCount}`
      : undefined,
  }));
}

export function toSeriesEntityCards(
  items: RankedSeriesEntity[],
  showScore = false,
): RankedEntityCard[] {
  return items.map((item) => ({
    name: item.name,
    href: item.href,
    meta: `${item.workCount}作品`,
    imageUrl: item.imageUrl,
    scoreDetail: showScore
      ? `score ${item.score} / 人気合計 ${item.breakdown.workPopularityScoreSum} / 新作 ${item.breakdown.recentNewCount}`
      : undefined,
  }));
}
