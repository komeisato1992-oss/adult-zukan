import type { AdminNavItem } from "@/lib/admin/navigation";

/** 同人図鑑管理サイドバー（第1段階） */
export const doujinAdminNavItems: AdminNavItem[] = [
  {
    id: "doujin-dashboard",
    label: "ダッシュボードTOP",
    icon: "🏠",
    href: "/admin/doujin",
  },
  {
    id: "doujin-works",
    label: "作品管理",
    icon: "📚",
    href: "/admin/doujin/works",
  },
  {
    id: "doujin-circles",
    label: "サークル管理",
    icon: "⭕",
    href: "/admin/doujin/circles",
  },
  {
    id: "doujin-authors",
    label: "作者管理",
    icon: "✍️",
    href: "/admin/doujin/authors",
  },
  {
    id: "doujin-series",
    label: "シリーズ管理",
    icon: "📖",
    href: "/admin/doujin/series",
  },
  {
    id: "doujin-genres",
    label: "ジャンル管理",
    icon: "🏷",
    href: "/admin/doujin/genres",
  },
  {
    id: "doujin-ranking",
    label: "ランキング管理",
    icon: "🏆",
    href: "/admin/doujin/ranking",
    disabled: true,
  },
  {
    id: "doujin-sale",
    label: "セール管理",
    icon: "💰",
    href: "/admin/doujin/sale",
    disabled: true,
  },
  {
    id: "doujin-add",
    label: "データ追加",
    icon: "📥",
    href: "/admin/doujin/fetch",
  },
  {
    id: "doujin-history",
    label: "更新履歴",
    icon: "🗒",
    href: "/admin/doujin/history",
    disabled: true,
  },
  {
    id: "doujin-seo",
    label: "SEO管理",
    icon: "📈",
    href: "/admin/doujin/analytics",
  },
  {
    id: "doujin-sitemap",
    label: "サイトマップ",
    icon: "🗺",
    href: "/admin/doujin/sitemap",
    disabled: true,
  },
  {
    id: "doujin-gsc",
    label: "Search Console",
    icon: "🔎",
    href: "/admin/doujin/analytics",
  },
  {
    id: "doujin-ga4",
    label: "GA4",
    icon: "📊",
    href: "/admin/doujin/analytics",
  },
  {
    id: "doujin-dmm",
    label: "DMM成果",
    icon: "💴",
    href: "/admin/doujin/analytics#dmm",
  },
  {
    id: "doujin-sync",
    label: "同期・診断",
    icon: "🔄",
    href: "/admin/doujin/api-diagnostic",
  },
];
