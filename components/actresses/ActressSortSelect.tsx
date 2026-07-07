"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ACTRESS_SORT_SELECT_OPTIONS,
  buildActressListUrl,
  parseActressLimitParam,
  parseActressSortParam,
  type ActressSortKey,
} from "@/lib/actresses/sort";

const BASE_PATH = "/actresses";

function readSortFromSearch(search: string): ActressSortKey {
  return parseActressSortParam(new URLSearchParams(search).get("sort"));
}

export function ActressSortSelect() {
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<ActressSortKey>(() =>
    readSortFromSearch(searchParams.toString()),
  );

  useEffect(() => {
    const handlePopState = () => {
      setSort(readSortFromSearch(window.location.search));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSortChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextSort = parseActressSortParam(event.target.value);
      const search = new URLSearchParams(window.location.search);
      const url = buildActressListUrl(BASE_PATH, {
        sort: nextSort,
        limit: parseActressLimitParam(search.get("limit")),
        page: 1,
        q: search.get("q")?.trim() ?? "",
      });

      window.history.replaceState(null, "", url);
      setSort(nextSort);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [],
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
