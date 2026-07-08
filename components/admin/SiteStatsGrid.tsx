import type { AdminSiteStats } from "@/lib/admin/stats";

type SiteStatsGridProps = {
  stats: AdminSiteStats;
};

const statItems: Array<{
  key: keyof AdminSiteStats;
  label: string;
  highlight?: boolean;
}> = [
  { key: "works", label: "作品数" },
  { key: "actresses", label: "女優数" },
  { key: "makers", label: "メーカー数" },
  { key: "labels", label: "レーベル数" },
  { key: "series", label: "シリーズ数" },
  { key: "genres", label: "ジャンル数" },
  { key: "noImage", label: "画像なし作品数", highlight: true },
  { key: "noActress", label: "女優なし作品数", highlight: true },
  { key: "noDescription", label: "説明文なし作品数", highlight: true },
];

export function SiteStatsGrid({ stats }: SiteStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {statItems.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-border bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-muted">{item.label}</p>
          <p
            className={`mt-2 text-3xl font-bold ${
              item.highlight ? "text-accent" : "text-foreground"
            }`}
          >
            {stats[item.key].toLocaleString("ja-JP")}
          </p>
        </div>
      ))}
    </div>
  );
}
