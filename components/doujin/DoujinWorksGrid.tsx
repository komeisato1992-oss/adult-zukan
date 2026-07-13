import { DoujinWorkCard } from "@/components/doujin/DoujinWorkCard";
import type { DoujinWork } from "@/lib/doujin/types";

type DoujinWorksGridProps = {
  works: DoujinWork[];
  className?: string;
};

/** 同人作品一覧グリッド（スマホ2列〜PC4列） */
export function DoujinWorksGrid({ works, className = "" }: DoujinWorksGridProps) {
  return (
    <div
      className={`grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
    >
      {works.map((work) => (
        <DoujinWorkCard key={work.id} work={work} />
      ))}
    </div>
  );
}
