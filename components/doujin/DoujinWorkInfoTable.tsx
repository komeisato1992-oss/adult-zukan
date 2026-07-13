import Link from "next/link";
import { DoujinProductFormatBadge } from "@/components/doujin/DoujinProductFormatBadge";
import type { DoujinInfoRow } from "@/lib/doujin/work-detail";
import { DoujinSectionHeading } from "@/components/doujin/DoujinSectionHeading";

type DoujinWorkInfoTableProps = {
  rows: DoujinInfoRow[];
};

const INFO_LINK_CLASS = "text-[#2563EB] hover:underline";

function DoujinInfoTableCell({ row }: { row: DoujinInfoRow }) {
  if (row.productFormat) {
    return <DoujinProductFormatBadge normalizedFormat={row.productFormat} size="sm" />;
  }

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

  if (row.valueTone === "price" && row.value) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-2">
        <span className="text-base font-bold text-price">{row.value}</span>
        {row.trailing ? (
          <span className="text-sm font-semibold text-price">{row.trailing}</span>
        ) : null}
      </span>
    );
  }

  if (row.valueTone === "original" && row.value) {
    return <span className="text-muted line-through">{row.value}</span>;
  }

  return row.value;
}

/** アダルト図鑑 DmmWorkInfoTable と同デザインの作品情報テーブル */
export function DoujinWorkInfoTable({ rows }: DoujinWorkInfoTableProps) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="doujin-work-info-title" className="mt-10">
      <DoujinSectionHeading title="作品情報" id="doujin-work-info-title" />

      <div className="overflow-x-auto">
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
                  className={`bg-white px-4 py-3 text-foreground [overflow-wrap:anywhere] ${
                    row.multiline ? "whitespace-pre-wrap leading-relaxed" : ""
                  }`}
                >
                  <DoujinInfoTableCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
