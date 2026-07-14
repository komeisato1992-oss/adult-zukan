"use client";

import Link from "next/link";
import { useState } from "react";
import type { DmmInfoRow } from "@/lib/dmm/display";

type DmmWorkInfoTableProps = {
  rows: DmmInfoRow[];
};

const INFO_LINK_CLASS = "text-accent hover:underline";

/** モバイル上部カードで既に表示する項目（作品情報の重複を避ける） */
const MOBILE_CARD_COVERED_LABELS = new Set([
  "品番",
  "メーカー",
  "レーベル",
  "発売日",
  "発売予定日",
  "女優",
  "価格",
  "作品説明",
]);

function DmmInfoTableCell({
  row,
  linkLimit,
}: {
  row: DmmInfoRow;
  linkLimit?: number;
}) {
  if (row.links && row.links.length > 0) {
    const visible =
      linkLimit != null ? row.links.slice(0, linkLimit) : row.links;
    const rest =
      linkLimit != null ? row.links.length - visible.length : 0;

    return (
      <>
        {visible.map((link, index) => (
          <span key={`${link.href}-${link.label}`}>
            {index > 0 && "、"}
            <Link href={link.href} className={INFO_LINK_CLASS}>
              {link.label}
            </Link>
          </span>
        ))}
        {rest > 0 ? (
          <span className="text-muted"> 他{rest}件</span>
        ) : null}
      </>
    );
  }

  return row.value;
}

function MobileExpandableLinks({ row }: { row: DmmInfoRow }) {
  const [expanded, setExpanded] = useState(false);
  if (!row.links || row.links.length === 0) {
    return <DmmInfoTableCell row={row} />;
  }

  const limit = 4;
  const needsToggle = row.links.length > limit;
  const visible = expanded ? row.links : row.links.slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className="rounded border border-border bg-white px-2 py-0.5 text-[12px] text-accent hover:border-accent"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {needsToggle ? (
        <button
          type="button"
          className="mt-1.5 text-[12px] font-medium text-accent hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "閉じる" : "すべて見る"}
        </button>
      ) : null}
    </div>
  );
}

export function DmmWorkInfoTable({ rows }: DmmWorkInfoTableProps) {
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  if (rows.length === 0) {
    return null;
  }

  const mobileExtraRows = rows.filter(
    (row) => !MOBILE_CARD_COVERED_LABELS.has(row.label),
  );

  return (
    <section aria-labelledby="work-info-title" className="mt-10 max-[768px]:mt-7">
      <h2
        id="work-info-title"
        className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground max-[768px]:mb-3 max-[768px]:text-[17px]"
      >
        作品情報
      </h2>

      {/* PC: 既存テーブル（変更しない） */}
      <div className="hidden overflow-x-auto min-[769px]:block">
        <table className="w-full min-w-[280px] border-collapse border border-border text-sm">
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-border last:border-b-0"
              >
                <th
                  scope="row"
                  className="w-[7.5rem] whitespace-nowrap bg-surface px-4 py-3 text-left font-medium text-muted sm:w-32"
                >
                  {row.label}
                </th>
                <td
                  className={`bg-white px-4 py-3 text-foreground ${
                    row.multiline ? "whitespace-pre-wrap leading-relaxed" : ""
                  }`}
                >
                  <DmmInfoTableCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* スマートフォン: 上部カードと重複する項目は出さず、残りだけ詳細へ */}
      <div className="min-[769px]:hidden">
        {mobileExtraRows.length === 0 ? (
          <p className="text-[13px] text-muted">
            主な作品情報はページ上部に表示しています。
          </p>
        ) : (
          <>
            <button
              type="button"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-accent hover:bg-accent-light"
              aria-expanded={mobileDetailsOpen}
              onClick={() => setMobileDetailsOpen((prev) => !prev)}
            >
              {mobileDetailsOpen ? "詳細情報を閉じる" : "詳細情報を見る"}
            </button>
            {mobileDetailsOpen ? (
              <dl className="mt-2 divide-y divide-border rounded-lg border border-border bg-white">
                {mobileExtraRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[5.5rem_1fr] gap-2 px-3 py-2.5"
                  >
                    <dt className="text-[12px] font-medium text-muted">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 break-words text-[14px] text-foreground">
                      {row.links && row.links.length > 4 ? (
                        <MobileExpandableLinks row={row} />
                      ) : (
                        <DmmInfoTableCell row={row} linkLimit={5} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
