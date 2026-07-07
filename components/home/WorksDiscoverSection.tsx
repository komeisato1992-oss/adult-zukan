import Link from "next/link";
import {
  HOME_WORK_SORT_KEYS,
  WORK_SORT_LABELS,
} from "@/lib/works/sort";

export function WorksDiscoverSection() {
  return (
    <section aria-labelledby="works-discover-heading" className="mb-10">
      <h2
        id="works-discover-heading"
        className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
      >
        作品を探す
      </h2>
      <div className="flex flex-wrap gap-2">
        {HOME_WORK_SORT_KEYS.map((key) => (
          <Link
            key={key}
            href={`/works?sort=${key}`}
            prefetch
            className="rounded-full border border-border bg-white px-4 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {WORK_SORT_LABELS[key]}
          </Link>
        ))}
      </div>
    </section>
  );
}
