"use client";

import { useMemo } from "react";
import { SeoDataTable } from "@/components/admin/seo/SeoDataTable";
import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
  SEO_PAGE_TYPE_LABELS,
} from "@/components/admin/seo/format";
import { enrichPagesWithComparison } from "@/lib/admin/seo-insights";
import type { SeoPageRow } from "@/lib/admin/seo-types";

type SeoPagesTabProps = {
  pages: SeoPageRow[];
  previousPages?: SeoPageRow[];
};

export function SeoPagesTab({ pages, previousPages = [] }: SeoPagesTabProps) {
  const rows = useMemo(
    () => enrichPagesWithComparison(pages, previousPages),
    [pages, previousPages],
  );

  return (
    <SeoDataTable
      rows={rows}
      searchPlaceholder="URL / タイトルで検索"
      searchFilter={(row, query) =>
        row.url.toLowerCase().includes(query) ||
        row.title.toLowerCase().includes(query)
      }
      emptyMessage="Search Console からページデータを取得すると表示されます。"
      columns={[
        {
          key: "title",
          label: "ページ",
          sortable: true,
          sortValue: (row) => row.title,
          render: (row) => (
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="block hover:text-accent"
            >
              <p className="font-medium">{row.title}</p>
              <p className="mt-1 text-xs text-muted">
                {SEO_PAGE_TYPE_LABELS[row.pageType] ?? row.pageType}
              </p>
              <p className="mt-1 break-all text-xs text-muted">{row.url}</p>
            </a>
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
