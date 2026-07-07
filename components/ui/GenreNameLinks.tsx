import Link from "next/link";
import { ACTRESS_LINK_CLASS } from "@/components/ui/ActressNameLinks";
import { getGenreDetailPath } from "@/lib/entities/paths";
import { slugify } from "@/lib/utils";

type GenreNameLinksProps = {
  names: string[];
  separator?: string;
  className?: string;
  emptyClassName?: string;
};

export function GenreNameLinks({
  names,
  separator = "・",
  className = "",
  emptyClassName = "text-muted",
}: GenreNameLinksProps) {
  const normalized = names.filter(Boolean);

  if (normalized.length === 0) {
    return <span className={emptyClassName}>-</span>;
  }

  return (
    <span className={className}>
      {normalized.map((name, index) => {
        const slug = slugify(name);
        if (!slug) {
          return (
            <span key={`${name}-${index}`}>
              {index > 0 && separator}
              {name}
            </span>
          );
        }

        return (
          <span key={name}>
            {index > 0 && separator}
            <Link href={getGenreDetailPath(slug)} className={ACTRESS_LINK_CLASS}>
              {name}
            </Link>
          </span>
        );
      })}
    </span>
  );
}
