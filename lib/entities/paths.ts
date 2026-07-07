/** メーカー・シリーズ・ジャンル・レーベル詳細の slug をURLセグメント用にエンコード */
export function encodeEntitySlug(slug: string): string {
  return encodeURIComponent(slug);
}

export function decodeEntitySlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function getMakerDetailPath(slug: string): string {
  return `/makers/${encodeEntitySlug(slug)}`;
}

export function getSeriesDetailPath(slug: string): string {
  return `/series/${encodeEntitySlug(slug)}`;
}

export function getGenreDetailPath(slug: string): string {
  return `/genres/${encodeEntitySlug(slug)}`;
}

export function getLabelDetailPath(slug: string): string {
  return `/labels/${encodeEntitySlug(slug)}`;
}
