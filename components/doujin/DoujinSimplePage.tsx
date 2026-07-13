import Link from "next/link";

type BreadcrumbItem = {
  href?: string;
  label: string;
};

type DoujinSimplePageProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
};

export function DoujinSimplePage({
  title,
  description,
  children,
  breadcrumbs,
}: DoujinSimplePageProps) {
  return (
    <div>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="パンくず" className="mb-4 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            {breadcrumbs.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden>＞</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-accent hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-6">{children}</div>
      <Link
        href="/doujin"
        className="mt-8 inline-flex text-sm font-medium text-accent hover:underline"
      >
        ← 同人図鑑トップへ
      </Link>
    </div>
  );
}
