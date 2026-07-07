import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getSeriesDetailPath } from "@/lib/entities/paths";
import type { ActressPageSeries } from "@/lib/dmm/actress-page";

type ActressSeriesLinksProps = {
  series: ActressPageSeries[];
};

export function ActressSeriesLinks({ series }: ActressSeriesLinksProps) {
  if (series.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="actress-series" className="mb-10">
      <SectionHeader title="シリーズ" id="actress-series" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((entry) => (
          <Link
            key={entry.slug}
            href={getSeriesDetailPath(entry.slug)}
            className="rounded border border-border bg-white p-4 transition-shadow hover:shadow-md"
          >
            <h3 className="text-sm font-bold text-foreground">{entry.name}</h3>
            <p className="mt-1 text-xs text-muted">{entry.workCount}作品</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
