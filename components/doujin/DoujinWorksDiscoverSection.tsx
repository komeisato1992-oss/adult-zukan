import Link from "next/link";

const DISCOVER_LINKS = [
  { href: "/doujin/works", label: "人気順" },
  { href: "/doujin/works", label: "新着順" },
  { href: "/doujin/sale", label: "セール" },
  { href: "/doujin/ranking", label: "ランキング" },
  { href: "/doujin/works", label: "価格が高い順" },
  { href: "/doujin/works", label: "価格が安い順" },
  { href: "/doujin/genres", label: "ジャンルから探す" },
  { href: "/doujin/circles", label: "サークルから探す" },
  { href: "/doujin/authors", label: "作者から探す" },
  { href: "/doujin/series", label: "シリーズから探す" },
] as const;

export function DoujinWorksDiscoverSection() {
  return (
    <section aria-labelledby="doujin-works-discover-heading" className="mb-10">
      <h2
        id="doujin-works-discover-heading"
        className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
      >
        作品の並び替え
      </h2>
      <div className="flex flex-wrap gap-2">
        {DISCOVER_LINKS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            prefetch
            className="rounded-full border border-border bg-white px-4 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
