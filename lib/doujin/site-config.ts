import { SITE_URL } from "@/lib/constants";
import { doujinBrand } from "@/lib/doujin/brand";
import type { DoujinNavItem } from "@/lib/doujin/types";

export const DOUJIN_BASE_PATH = "/doujin";

export const doujinSiteConfig = {
  name: "同人図鑑",
  description:
    "同人図鑑では、複数の同人作品を並べて比較できます。価格・サークル・作者・シリーズ・ジャンルなどを一画面で比較しながら作品を探せます。",
  url: SITE_URL,
  basePath: DOUJIN_BASE_PATH,
  ogImage: "/og.png",
  locale: "ja_JP",
  accentColor: doujinBrand.primary,
  logo: "/doujin/logo.png",
  logoIcon: "/doujin/logo-icon.png",
  icon: "/doujin/icon.png",
  appleTouchIcon: "/doujin/apple-touch-icon.png",
  /** スマートフォンコンパクトヘッダー専用（PCは logo を維持） */
  logoCompact: "/images/doujin-zukan-logo-horizontal.webp",
  logoText: "同人図鑑",
  tagline: "検索・比較・ランキングで作品選びをもっと便利に",
} as const;

export const doujinNavItems: readonly DoujinNavItem[] = [
  { href: "/doujin", label: "TOP" },
  { href: "/doujin/works", label: "作品一覧" },
  { href: "/doujin/favorites", label: "お気に入り❤️" },
  { href: "/doujin/ranking", label: "ランキング" },
  { href: "/doujin/circles", label: "サークル" },
  { href: "/doujin/genres", label: "ジャンル" },
  { href: "/doujin/series", label: "シリーズ" },
  { href: "/doujin/authors", label: "作者" },
  { href: "/doujin/search", label: "検索" },
] as const;

export const doujinMobileBottomNavItems: readonly DoujinNavItem[] = [
  { href: "/doujin", label: "TOP" },
  { href: "/doujin/works", label: "作品" },
  { href: "/doujin/favorites", label: "お気に入り" },
  { href: "/doujin/ranking", label: "ランキング" },
  { href: "/doujin/search", label: "検索" },
] as const;

export const doujinLegalLinks: readonly DoujinNavItem[] = [
  { href: "/about", label: "サイトについて" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/contact", label: "お問い合わせ" },
  { href: "/age-restriction", label: "18歳未満閲覧禁止" },
  { href: "/doujin/history", label: "閲覧履歴" },
] as const;

export const doujinSidebarSections = [
  {
    title: "コンテンツ",
    links: [
      { href: "/doujin", label: "TOP" },
      { href: "/doujin/works", label: "作品一覧" },
      { href: "/doujin/favorites", label: "お気に入り❤️" },
      { href: "/doujin/ranking", label: "ランキング" },
      { href: "/doujin/circles", label: "サークル一覧" },
      { href: "/doujin/genres", label: "ジャンル一覧" },
      { href: "/doujin/series", label: "シリーズ一覧" },
      { href: "/doujin/authors", label: "作者一覧" },
      { href: "/doujin/search", label: "検索" },
      { href: "/doujin/compare", label: "比較" },
    ],
  },
  {
    title: "人気ジャンル",
    links: [
      { href: "/doujin/genres", label: "オリジナル" },
      { href: "/doujin/genres", label: "ファンタジー" },
      { href: "/doujin/genres", label: "コメディ" },
      { href: "/doujin/genres", label: "シリアス" },
      { href: "/doujin/genres", label: "日常" },
      { href: "/doujin/genres", label: "恋愛" },
    ],
  },
] as const;

export const doujinPageIntros = {
  home: doujinSiteConfig.description,
  works: "同人図鑑の作品一覧ページです。タイトル・サークル・作者・ジャンルから作品を検索できます。",
  favorites: "お気に入りに登録した同人作品の一覧です。",
  sale: "セール中の同人作品一覧です。",
  ranking: "人気同人作品・サークル・作者のランキングです。",
  circles: "サークル一覧ページです。",
  authors: "同人作品の作者一覧です。作者ごとの代表作品や作品数を確認できます。",
  series: "シリーズ一覧ページです。",
  genres: "ジャンル別の同人作品一覧です。",
  search: "同人作品・サークル・作者・ジャンルを横断検索できます。",
  compare: "複数の同人作品を並べて比較できます。",
  history: "最近閲覧した同人作品の履歴です。",
} as const;
