import Link from "next/link";
import { memo } from "react";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import {
  buildWorksSortHref,
  type WorkSortKey,
  type WorkSortOption,
} from "@/lib/works/sort";

type WorksSortNavProps = {
  basePath?: string;
  currentSort: WorkSortKey;
  options: WorkSortOption[];
  query?: Record<string, string | undefined>;
};

function WorksSortNavInner({
  basePath = "/works",
  currentSort,
  options,
  query = {},
}: WorksSortNavProps) {
  return (
    <WorksListControlGroup label="並び替え" className="mb-4">
      <nav
        aria-label="並び替え"
        className="flex flex-wrap gap-2 max-[768px]:flex-nowrap max-[768px]:overflow-x-auto max-[768px]:overscroll-x-contain max-[768px]:pb-1 max-[768px]:[-webkit-overflow-scrolling:touch] max-[768px]:[scrollbar-width:none] max-[768px]:[&::-webkit-scrollbar]:hidden"
      >
        {options.map(({ key, label }) => {
          const isActive = key === currentSort;
          return (
            <Link
              key={key}
              href={buildWorksSortHref(basePath, key, query)}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-white text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </WorksListControlGroup>
  );
}

export const WorksSortNav = memo(WorksSortNavInner);
