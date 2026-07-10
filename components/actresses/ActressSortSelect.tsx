"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ACTRESS_SORT_SELECT_OPTIONS,
  buildActressListUrl,
  parseActressLimitParam,
  parseActressSortParam,
} from "@/lib/actresses/sort";

const BASE_PATH = "/actresses";

export function ActressSortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = parseActressSortParam(searchParams.get("sort"));

  const handleSortChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextSort = parseActressSortParam(event.target.value);
      const url = buildActressListUrl(BASE_PATH, {
        sort: nextSort,
        limit: parseActressLimitParam(searchParams.get("limit")),
        page: 1,
        q: searchParams.get("q")?.trim() ?? "",
      });

      router.push(url);
    },
    [router, searchParams],
  );

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <label htmlFor="actress-sort" className="text-sm text-muted">
        並び替え
      </label>
      <select
        id="actress-sort"
        value={sort}
        onChange={handleSortChange}
        className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
      >
        {ACTRESS_SORT_SELECT_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
