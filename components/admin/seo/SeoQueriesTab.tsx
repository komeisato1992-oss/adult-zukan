"use client";

import { useMemo } from "react";
import { SeoDataTable } from "@/components/admin/seo/SeoDataTable";
import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import { computeChangePercent } from "@/lib/admin/seo-insights";
import type { SeoQueryRow } from "@/lib/admin/seo-types";

type SeoQueriesTabProps = {
  queries: SeoQueryRow[];
  previousQueries?: SeoQueryRow[];
};

export function SeoQueriesTab({
  queries,
  previousQueries = [],
}: SeoQueriesTabProps) {
  const rows = useMemo(() => {
    const previousMap = new Map(
      previousQueries.map((row) => [row.keyword, row.clicks]),
    );
    return queries.map((row) => {
      const prevClicks = previousMap.get(row.keyword) ?? 0;
      const isNew = prevClicks === 0 && row.clicks > 0;
      return {
        ...row,
        isNew,
        changePercent: isNew
          ? null
          : computeChangePercent(row.clicks, prevClicks),
      };
    });
  }, [queries, previousQueries]);

  return (
    <SeoDataTable
      rows={rows}
      searchPlaceholder="検索キーワードで検索"
      searchFilter={(row, query) => row.keyword.toLowerCase().includes(query)}
      emptyMessage="Search Console からキーワードデータを取得すると表示されます。"
      columns={[
        {
          key: "keyword",
          label: "検索キーワード",
          sortable: true,
          sortValue: (row) => row.keyword,
          render: (row) => (
            <span
              className="line-clamp-2 break-words [overflow-wrap:anywhere]"
              title={row.keyword}
            >
              {row.keyword}
            </span>
          ),
        },
        {
          key: "clicks",
          label: "クリック数",
          sortable: true,
          sortValue: (row) => row.clicks,
          className: "whitespace-nowrap",
          render: (row) => formatSeoNumber(row.clicks),
        },
        {
          key: "impressions",
          label: "表示回数",
          sortable: true,
          sortValue: (row) => row.impressions,
          className: "whitespace-nowrap",
          render: (row) => formatSeoNumber(row.impressions),
        },
        {
          key: "ctr",
          label: "CTR",
          sortable: true,
          sortValue: (row) => row.ctr,
          className: "whitespace-nowrap",
          render: (row) => formatSeoPercent(row.ctr),
        },
        {
          key: "position",
          label: "平均順位",
          sortable: true,
          sortValue: (row) => row.position,
          className: "whitespace-nowrap",
          render: (row) => formatSeoPosition(row.position),
        },
        {
          key: "change",
          label: "前期間比",
          sortable: true,
          sortValue: (row) => row.changePercent ?? -999,
          className: "whitespace-nowrap",
          render: (row) =>
            row.isNew ? "新規" : formatSeoChangePercent(row.changePercent),
        },
      ]}
    />
  );
}
