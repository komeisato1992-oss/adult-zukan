const SEP = "｜";

export const seoTitles = {
  home: `アダルト図鑑${SEP}AV作品・女優・メーカー検索`,
  works: `AV作品一覧${SEP}人気・新作・セール作品`,
  actresses: `女優一覧${SEP}人気女優・出演作品検索`,
  makers: `メーカー一覧${SEP}人気ブランド・作品検索`,
  labels: `レーベル一覧${SEP}ブランド別作品検索`,
  series: `シリーズ一覧${SEP}人気シリーズ・作品検索`,
  genres: `ジャンル一覧${SEP}ジャンル別作品検索`,
  search: `作品検索${SEP}キーワード横断検索`,
  articles: `記事一覧${SEP}おすすめ・まとめ記事`,
} as const;

export function createWorkTitle(title: string): string {
  return `${title}${SEP}出演女優・メーカー・価格・作品情報`;
}

export function createActressTitle(name: string): string {
  return `${name}${SEP}出演作品一覧`;
}

export function createMakerTitle(name: string): string {
  return `${name}${SEP}人気作品一覧`;
}

export function createSeriesTitle(name: string): string {
  return `${name}${SEP}作品一覧`;
}

export function createGenreTitle(name: string): string {
  return `${name}${SEP}人気作品一覧`;
}

export function createLabelTitle(name: string): string {
  return `${name}${SEP}作品一覧`;
}

export function createSearchResultTitle(query: string): string {
  return `「${query}」の検索結果${SEP}作品・女優検索`;
}

export function createArticleTitle(title: string): string {
  return `${title}${SEP}アダルト図鑑`;
}
