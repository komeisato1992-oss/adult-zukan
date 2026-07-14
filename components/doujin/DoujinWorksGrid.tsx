import { DoujinWorkCard } from "@/components/doujin/DoujinWorkCard";
import { DOUJIN_WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";
import type { DoujinWork } from "@/lib/doujin/types";

type DoujinWorksGridProps = {
  works: DoujinWork[];
  className?: string;
};

/** 同人作品一覧グリッド（モバイル: 2列→390px〜3列 / PC ≥769px: 既存の2→3→4列） */
export function DoujinWorksGrid({ works, className = "" }: DoujinWorksGridProps) {
  return (
    <div className={`${DOUJIN_WORK_LIST_GRID_CLASSNAME} ${className}`.trim()}>
      {works.map((work) => (
        <DoujinWorkCard key={work.id} work={work} />
      ))}
    </div>
  );
}
