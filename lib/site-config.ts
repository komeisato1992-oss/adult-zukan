import { SITE_URL } from "@/lib/constants";
import { brand } from "@/lib/brand";

export { SITE_URL, buildSiteUrl } from "@/lib/constants";

export const siteConfig = {
  name: "アダルト図鑑",
  description:
    "アダルト作品の情報をわかりやすく紹介するポータルサイト。作品ランキング・女優検索・ジャンル別一覧・セール情報から、お好みの作品を見つけられます。",
  url: SITE_URL,
  ogImage: "/og.png",
  locale: "ja_JP",
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE,
  accentColor: brand.primary,
  logo: "/logo.png",
  logoIcon: "/logo-icon.png",
} as const;

export const pageIntros = {
  works:
    "アダルト図鑑の作品一覧ページです。品番・タイトル・女優名・メーカー名・ジャンル名から作品を検索できます。人気順・新着順・セール情報で並び替えも可能。各作品の詳細ページでは、出演女優、メーカー、ジャンル、配信価格などの情報を確認でき、配信サービスの公式ページへスムーズに移動できます。",
  actresses:
    "人気女優の一覧ページです。アダルト図鑑では、30名以上の女優プロフィールと出演作品を掲載しています。女優名をクリックすると、出演作品の一覧や関連ジャンル、シリーズ情報を確認できます。ランキング順での表示にも対応しており、人気女優から効率よく作品を探せます。",
  makers:
    "アダルト作品メーカーの一覧ページです。20社以上のメーカー情報と、各メーカーの代表作・新着作を掲載しています。メーカーごとの作風やジャンル傾向を比較しながら、お好みのブランドを見つけられます。メーカー詳細ページでは、所属作品を一覧で確認できます。",
  genres:
    "ジャンル別の作品一覧ページです。20種類以上のジャンルから、お好みの作品タイプを選んで探せます。各ジャンルページにはオリジナルの解説文を掲載し、ジャンルの特徴やおすすめの探し方をわかりやすく紹介しています。",
  series:
    "人気シリーズの一覧ページです。30以上のシリーズに属する作品を、シリーズ単位でまとめて確認できます。続編や関連作品を効率よく探したい方に最適です。各シリーズページでは、出演女優やメーカー、ジャンル情報も合わせて比較できます。",
  labels:
    "レーベル別の作品一覧ページです。20のレーベルから、ブランドごとの作品ラインナップを確認できます。各レーベルページでは、所属メーカー・人気作品・全作品一覧を掲載しています。",
  ranking:
    "人気作品・女優・メーカー・シリーズのランキングページです。週間・月間ランキングも掲載し、トレンドを把握しながら作品選びができます。",
  search:
    "作品・女優・メーカー・ジャンル・シリーズを横断検索できるページです。キーワードを入力するだけで、関連する作品を一覧表示します。品番がわかっている場合はそのまま入力、女優名やメーカー名での検索も可能です。",
  sitemap:
    "アダルト図鑑のサイトマップです。当サイトの全ページへのリンクを一覧で確認できます。作品一覧、女優、メーカー、ジャンル、シリーズ、法的情報ページなど、主要コンテンツへの入口をまとめています。",
} as const;

export const navItems = [
  { href: "/", label: "TOP" },
  { href: "/works", label: "作品一覧" },
  { href: "/favorites", label: "お気に入り" },
  { href: "/ranking", label: "ランキング" },
  { href: "/works?sale=1", label: "セール" },
  { href: "/actresses", label: "女優" },
  { href: "/makers", label: "メーカー" },
  { href: "/labels", label: "レーベル" },
  { href: "/series", label: "シリーズ" },
  { href: "/genres", label: "ジャンル" },
  { href: "/search", label: "検索" },
] as const;

export const legalLinks = [
  { href: "/about", label: "アダルト図鑑とは" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/contact", label: "お問い合わせ" },
  { href: "/age-restriction", label: "18歳未満閲覧禁止" },
  { href: "/history", label: "閲覧履歴" },
  { href: "/sitemap", label: "サイトマップ" },
] as const;

export const sidebarSections = [
  {
    title: "コンテンツ",
    links: [
      { href: "/", label: "TOP" },
      { href: "/works", label: "作品一覧" },
      { href: "/favorites", label: "お気に入り" },
      { href: "/works?sale=1", label: "セール作品" },
      { href: "/ranking", label: "ランキング" },
      { href: "/actresses", label: "女優一覧" },
      { href: "/makers", label: "メーカー一覧" },
      { href: "/labels", label: "レーベル一覧" },
      { href: "/series", label: "シリーズ一覧" },
      { href: "/genres", label: "ジャンル一覧" },
      { href: "/search", label: "検索" },
    ],
  },
  {
    title: "人気ジャンル",
    links: [
      { href: "/genres/ドラマ", label: "ドラマ" },
      { href: "/genres/恋愛", label: "恋愛" },
      { href: "/genres/ドキュメンタリー", label: "ドキュメンタリー" },
      { href: "/genres/企画", label: "企画" },
      { href: "/genres/熟女", label: "熟女" },
      { href: "/genres/新人", label: "新人" },
    ],
  },
] as const;
