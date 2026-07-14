import Link from "next/link";
import type { DmmInfoRow } from "@/lib/dmm/display";

type DmmWorkInfoTableProps = {
  rows: DmmInfoRow[];
};

const INFO_LINK_CLASS = "text-accent hover:underline";

/**
 * ヒーロー主要情報・説明と重複するため詳細表示から除外するラベル。
 */
const DETAIL_EXCLUDED = new Set([
  "作品説明",
  "女優",
  "価格",
  "評価",
  "収録時間",
  "発売日",
  "発売予定日",
]);

function DmmInfoTableCell({ row }: { row: DmmInfoRow }) {
  if (row.links && row.links.length > 0) {
    return (
      <>
        {row.links.map((link, index) => (
          <span key={`${link.href}-${link.label}`}>
            {index > 0 && "、"}
            <Link href={link.href} className={INFO_LINK_CLASS}>
              {link.label}
            </Link>
          </span>
        ))}
      </>
    );
  }

  return row.value;
}

/** 作品情報（PC/スマホとも常時テーブル表示） */
export function DmmWorkInfoTable({ rows }: DmmWorkInfoTableProps) {
  if (rows.length === 0) {
    return null;
  }

  const detailRows = rows.filter((row) => !DETAIL_EXCLUDED.has(row.label));

  if (detailRows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="work-info-title" className="mt-8 max-[768px]:mt-6">
      <h2
        id="work-info-title"
        className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground max-[768px]:mb-3 max-[768px]:text-[17px]"
      >
        作品情報
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse border border-border text-sm">
          <tbody>
            {detailRows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-border last:border-b-0"
              >
                <th
                  scope="row"
                  className="w-[7.5rem] whitespace-nowrap bg-surface px-4 py-3 text-left font-medium text-muted max-[768px]:w-[5.5rem] max-[768px]:px-3 max-[768px]:py-2.5 max-[768px]:text-[12px] sm:w-32"
                >
                  {row.label}
                </th>
                <td
                  className={`bg-white px-4 py-3 text-foreground max-[768px]:px-3 max-[768px]:py-2.5 max-[768px]:text-[14px] ${
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
    </section>
  );
}
