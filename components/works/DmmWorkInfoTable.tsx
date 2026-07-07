import Link from "next/link";
import type { DmmInfoRow } from "@/lib/dmm/display";

type DmmWorkInfoTableProps = {
  rows: DmmInfoRow[];
};

const INFO_LINK_CLASS = "text-accent hover:underline";

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

export function DmmWorkInfoTable({ rows }: DmmWorkInfoTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="work-info-title" className="mt-10">
      <h2
        id="work-info-title"
        className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
      >
        作品情報
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse border border-border text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
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
    </section>
  );
}
