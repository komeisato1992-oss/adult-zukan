import { DoujinAuthorCard } from "@/components/doujin/DoujinAuthorCard";
import { DoujinSectionHeading } from "@/components/doujin/DoujinSectionHeading";
import type { DoujinWorkAuthorSummary } from "@/lib/doujin/work-detail";

type DoujinWorkAuthorsSectionProps = {
  authors: DoujinWorkAuthorSummary[];
};

export function DoujinWorkAuthorsSection({
  authors,
}: DoujinWorkAuthorsSectionProps) {
  if (authors.length === 0) return null;

  return (
    <section aria-labelledby="doujin-work-authors-title" className="mt-12">
      <DoujinSectionHeading
        title="この作品の作者"
        id="doujin-work-authors-title"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {authors.map((author) => (
          <DoujinAuthorCard
            key={author.id}
            author={{
              id: author.id,
              name: author.name,
              workCount: author.workCount,
              latestReleaseDate: "",
              maxRating: 0,
              representativeWork: author.representativeWork,
            }}
          />
        ))}
      </div>
    </section>
  );
}
