import Link from "next/link";
import { getActressDetailPath } from "@/lib/actresses/slug";

export const ACTRESS_LINK_CLASS =
  "text-blue-600 hover:text-blue-700 hover:underline transition-colors";

type ActressNameLinksProps = {
  names: string[];
  separator?: string;
  className?: string;
  emptyClassName?: string;
};

export function ActressNameLinks({
  names,
  separator = "・",
  className = "",
  emptyClassName = "text-muted",
}: ActressNameLinksProps) {
  const normalized = names.filter(Boolean);

  if (normalized.length === 0) {
    return <span className={emptyClassName}>-</span>;
  }

  return (
    <span className={className}>
      {normalized.map((name, index) => (
        <span key={name}>
          {index > 0 && separator}
          <Link href={getActressDetailPath(name)} className={ACTRESS_LINK_CLASS}>
            {name}
          </Link>
        </span>
      ))}
    </span>
  );
}
