import Link from "next/link";

const rankingLinks = [
  { href: "/ranking/works", label: "人気作品" },
  { href: "/ranking/actresses", label: "人気女優" },
  { href: "/ranking/makers", label: "人気メーカー" },
  { href: "/ranking/series", label: "人気シリーズ" },
  { href: "/ranking/weekly", label: "週間ランキング" },
  { href: "/ranking/monthly", label: "月間ランキング" },
] as const;

type RankingNavProps = {
  current?: string;
};

export function RankingNav({ current }: RankingNavProps) {
  return (
    <nav
      aria-label="ランキングカテゴリ"
      className="mb-8 flex flex-wrap gap-2"
    >
      <Link
        href="/ranking"
        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          current === "/ranking"
            ? "border-accent bg-accent text-white"
            : "border-border text-foreground hover:border-accent hover:text-accent"
        }`}
      >
        すべて
      </Link>
      {rankingLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            current === link.href
              ? "border-accent bg-accent text-white"
              : "border-border text-foreground hover:border-accent hover:text-accent"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
