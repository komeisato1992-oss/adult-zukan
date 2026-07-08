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
  { id: "import", label: "作品追加", icon: "📥", href: "/admin/import" },
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
    label: "SEO（準備中）",
    icon: "📈",
    href: "/admin/seo",
    disabled: true,
  },
  {
    id: "analytics",
    label: "Analytics（準備中）",
    icon: "📊",
    href: "/admin/analytics",
    disabled: true,
  },
  {
    id: "settings",
    label: "設定（準備中）",
    icon: "⚙",
    href: "/admin/settings",
    disabled: true,
  },
];
