"use client";

import { SeoDataTable } from "@/components/admin/seo/SeoDataTable";
import {
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import type { SeoQueryRow } from "@/lib/admin/seo-types";

type SeoQueriesTabProps = {
  queries: SeoQueryRow[];
};

export function SeoQueriesTab({ queries }: SeoQueriesTabProps) {
  return (
    <SeoDataTable
      rows={queries}
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
            <span className="break-words [overflow-wrap:anywhere]">{row.keyword}</span>
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
      ]}
    />
  );
}
