"use client";

import { SeoDataTable } from "@/components/admin/seo/SeoDataTable";
import {
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
  SEO_PAGE_TYPE_LABELS,
} from "@/components/admin/seo/format";
import type { SeoPageRow } from "@/lib/admin/seo-types";

type SeoPagesTabProps = {
  pages: SeoPageRow[];
};

export function SeoPagesTab({ pages }: SeoPagesTabProps) {
  return (
    <SeoDataTable
      rows={pages}
      searchPlaceholder="URL / タイトルで検索"
      searchFilter={(row, query) =>
        row.url.toLowerCase().includes(query) ||
        row.title.toLowerCase().includes(query)
      }
      emptyMessage="Search Console からページデータを取得すると表示されます。"
      columns={[
        {
          key: "url",
          label: "URL",
          sortable: true,
          sortValue: (row) => row.url,
          render: (row) => (
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-accent hover:underline"
            >
              {row.url}
            </a>
          ),
        },
        {
          key: "title",
          label: "ページタイトル",
          sortable: true,
          sortValue: (row) => row.title,
          render: (row) => (
            <div>
              <p className="font-medium">{row.title}</p>
              <p className="mt-1 text-xs text-muted">
                {SEO_PAGE_TYPE_LABELS[row.pageType] ?? row.pageType}
              </p>
            </div>
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
