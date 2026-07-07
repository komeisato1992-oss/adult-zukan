import Link from "next/link";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { getDmmListItemImageUrl } from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type ActressLatestWorkProps = {
  item: DmmItem;
};

export function ActressLatestWork({ item }: ActressLatestWorkProps) {
  const imageUrl = getDmmListItemImageUrl(item);
  const releaseDate = getDmmReleaseDateInfo(item);
  const fanzaUrl = getDmmFanzaUrl(item);

  if (!hasValidImage(item) || !imageUrl) {
    return null;
  }

  return (
    <section aria-labelledby="actress-latest" className="mb-10">
      <SectionHeader title="最新作品" id="actress-latest" />
      <article className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="grid gap-4 sm:grid-cols-[168px_1fr] sm:items-start sm:gap-6">
          <Link
            href={`/works/${item.content_id}`}
            prefetch
            className="block max-w-[168px] sm:max-w-none"
          >
            <CatalogWorkImage
              src={imageUrl}
              alt={item.title}
              variant="portrait"
              sizes="168px"
            />
          </Link>
          <div className="flex flex-col gap-3 p-4 sm:p-5 sm:pl-0">
            <Link
              href={`/works/${item.content_id}`}
              prefetch
              className="text-base font-bold leading-snug text-foreground transition-colors hover:text-accent sm:text-lg"
            >
              {item.title}
            </Link>
            {releaseDate ? (
              <p className="text-sm text-muted">
                {releaseDate.label}：{releaseDate.value}
              </p>
            ) : null}
            {fanzaUrl ? <FanzaLinkButton href={fanzaUrl} /> : null}
          </div>
        </div>
      </article>
    </section>
  );
}
