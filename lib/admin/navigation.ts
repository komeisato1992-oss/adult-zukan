export type AdminNavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  disabled?: boolean;
};

export const adminNavItems: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "🏠", href: "/admin" },
  { id: "sns", label: "SNS管理", icon: "📢", href: "/admin/sns" },
  { id: "import", label: "作品管理", icon: "📥", href: "/admin/import" },
  {
    id: "actress-images",
    label: "女優代表画像",
    icon: "🖼",
    href: "/admin/actress-images",
  },
  {
    id: "doujin",
    label: "同人図鑑",
    icon: "📚",
    href: "/admin/doujin",
  },
  {
    id: "dmm",
    label: "DMM成果",
    icon: "💰",
    href: "/admin/dmm",
  },
  {
    id: "ai",
    label: "AI記事（準備中）",
    icon: "🤖",
    href: "/admin/ai",
    disabled: true,
  },
  {
    id: "data",
    label: "データ管理（準備中）",
    icon: "📦",
    href: "/admin/data",
    disabled: true,
  },
  {
    id: "seo",
    label: "SEO管理",
    icon: "📈",
    href: "/admin/seo",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "📊",
    href: "/admin",
  },
  {
    id: "settings",
    label: "設定",
    icon: "⚙",
    href: "/admin/settings",
  },
];
