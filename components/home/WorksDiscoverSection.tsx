import Link from "next/link";
import {
  HOME_WORK_SORT_KEYS,
  WORK_SORT_LABELS,
  type WorkSortKey,
} from "@/lib/works/sort-options";

const HOME_SORT_HREFS: Record<WorkSortKey, string> = {
  popular: "/works?sort=popular",
  "fanza-new": "/works?sort=fanza-new",
  added: "/works?sort=added",
  "release-new": "/works?sort=release-new",
  "price-desc": "/works?sort=price-desc",
  "price-asc": "/works?sort=price-asc",
  rating: "/works?sort=rating",
  discount: "/works?sale=1&sort=discount",
  "today-views": "/works?sort=today-views",
  "total-views": "/works?sort=total-views",
  "duration-desc": "/works?sort=duration-desc",
  random: "/works?sort=random",
};

/** スマホTOP用の短縮ラベル（リンク先・sort値は変更しない） */
const HOME_SORT_MOBILE_LABELS: Partial<Record<WorkSortKey, string>> = {
  "release-new": "発売日順",
  "price-asc": "安い順",
  "price-desc": "高い順",
  "duration-desc": "長時間順",
  random: "ランダム",
};

export function WorksDiscoverSection() {
  return (
    <section aria-labelledby="works-discover-heading" className="mb-8 min-[769px]:mb-10">
      <h2
        id="works-discover-heading"
        className="mb-3 border-l-4 border-accent pl-3 text-base font-bold text-foreground min-[769px]:mb-4 min-[769px]:text-lg"
      >
        作品を探す
      </h2>
      <div className="grid grid-cols-4 gap-1.5 min-[769px]:flex min-[769px]:flex-wrap min-[769px]:gap-2">
        {HOME_WORK_SORT_KEYS.map((key) => (
          <Link
            key={key}
            href={HOME_SORT_HREFS[key]}
            prefetch
            className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-border bg-white px-1 py-1.5 text-center text-[11px] leading-tight text-foreground transition-colors hover:border-accent hover:text-accent min-[769px]:min-h-0 min-[769px]:rounded-full min-[769px]:px-4 min-[769px]:py-2 min-[769px]:text-sm min-[769px]:leading-normal"
          >
            <span className="min-[769px]:hidden">
              {HOME_SORT_MOBILE_LABELS[key] ?? WORK_SORT_LABELS[key]}
            </span>
            <span className="hidden min-[769px]:inline">
              {WORK_SORT_LABELS[key]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
