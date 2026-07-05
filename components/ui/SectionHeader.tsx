import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  href?: string;
  linkLabel?: string;
  id?: string;
};

export function SectionHeader({
  title,
  href,
  linkLabel = "もっと見る",
  id,
}: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 id={id} className="text-xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-muted transition-colors hover:text-accent"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
