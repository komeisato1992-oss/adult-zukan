import Link from "next/link";
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

export function WorksSortNav({
  basePath = "/works",
  currentSort,
  options,
  query = {},
}: WorksSortNavProps) {
  return (
    <nav aria-label="並び替え" className="mb-4 flex flex-wrap gap-2">
      {options.map(({ key, label }) => {
        const isActive = key === currentSort;
        return (
          <Link
            key={key}
            href={buildWorksSortHref(basePath, key, query)}
            prefetch
            aria-current={isActive ? "true" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
  );
}
