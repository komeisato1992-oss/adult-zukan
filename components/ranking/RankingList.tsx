import Link from "next/link";
import { WorkCard } from "@/components/ui/WorkCard";
import { DmmWorkCard } from "@/components/works/DmmWorkCard";
import { ActressCard } from "@/components/ui/ActressCard";
import type { Work } from "@/data/types";
import type { Actress } from "@/data/types";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

type RankedWorkListProps = {
  works: Work[];
  showRank?: boolean;
};

export function RankedWorkList({ works, showRank = true }: RankedWorkListProps) {
  return (
    <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
  items: DmmItem[];
  showRank?: boolean;
};

export function DmmRankedWorkList({
  items,
  showRank = true,
}: DmmRankedWorkListProps) {
  const visibleItems = filterItemsWithValidImage(items);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {visibleItems.map((item, index) => (
        <li key={item.content_id} className="relative">
          {showRank && (
            <span className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow">
              {index + 1}
            </span>
          )}
          <DmmWorkCard item={item} />
        </li>
      ))}
    </ol>
  );
}

type RankedActressListProps = {
  actresses: Actress[];
  showRank?: boolean;
};

export function RankedActressList({
  actresses,
  showRank = true,
}: RankedActressListProps) {
  return (
    <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {actresses.map((actress, index) => (
        <li key={actress.slug} className="relative">
          {showRank && (
            <span className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow">
              {index + 1}
            </span>
          )}
          <ActressCard actress={actress} />
        </li>
      ))}
    </ol>
  );
}

type RankedEntityListProps = {
  items: { name: string; href: string; meta: string }[];
};

export function RankedEntityList({ items }: RankedEntityListProps) {
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
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{item.name}</p>
              <p className="text-xs text-muted">{item.meta}</p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
