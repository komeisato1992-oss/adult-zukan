/**
 * 同人作品の作品形式（コミック / CG / 動画 等）の正規化・表示定義。
 * 色やラベルはここでのみ管理する。
 *
 * 正規化コアは product-format-core.mjs と同期すること。
 */

export const DOUJIN_PRODUCT_FORMATS = [
  "comic",
  "cg",
  "video",
  "audio",
  "game",
  "voice_comic",
  "novel",
  "other",
] as const;

export type DoujinProductFormat = (typeof DOUJIN_PRODUCT_FORMATS)[number];

export type DoujinProductFormatStyle = {
  backgroundColor: string;
  color: string;
  borderColor: string;
};

export const DOUJIN_PRODUCT_FORMAT_LABELS: Record<DoujinProductFormat, string> =
  {
    comic: "コミック",
    cg: "CG",
    video: "動画",
    audio: "音声",
    game: "ゲーム",
    voice_comic: "ボイスコミック",
    novel: "ノベル",
    other: "その他",
  };

export const DOUJIN_FORMAT_STYLES: Record<
  DoujinProductFormat,
  DoujinProductFormatStyle
> = {
  comic: {
    backgroundColor: "#FFF2BF",
    color: "#7A6415",
    borderColor: "#E9D98C",
  },
  cg: {
    backgroundColor: "#F6E6FF",
    color: "#745080",
    borderColor: "#DFC6EA",
  },
  video: {
    backgroundColor: "#DFF3FA",
    color: "#356A7B",
    borderColor: "#B9DDE8",
  },
  audio: {
    backgroundColor: "#E5F5E8",
    color: "#3F714A",
    borderColor: "#C3E1C9",
  },
  game: {
    backgroundColor: "#FFE6D5",
    color: "#8A5A38",
    borderColor: "#EAC8AF",
  },
  voice_comic: {
    backgroundColor: "#E6E9FF",
    color: "#535F8A",
    borderColor: "#C6CDEC",
  },
  novel: {
    backgroundColor: "#F0E9DD",
    color: "#6F604D",
    borderColor: "#D8CDBD",
  },
  other: {
    backgroundColor: "#ECEFF2",
    color: "#5D6670",
    borderColor: "#D5DADF",
  },
};

const AMBIGUOUS_FORMAT_PATTERN =
  /^(同人(\s*[（(]\s*同人\s*[）)])?|doujin)$/i;

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function matchExplicitFormat(text: string): DoujinProductFormat | null {
  const t = normalizeText(text);
  if (!t || AMBIGUOUS_FORMAT_PATTERN.test(t)) return null;

  if (/ボイス\s*コミック|voice\s*comic/i.test(t)) return "voice_comic";
  if (/デジタル\s*ノベル|ノベル|小説|テキスト作品/.test(t)) return "novel";
  if (/ASMR|音声|ボイス(?!コミック)|Voice|オーディオ/i.test(t)) return "audio";
  if (
    /同人\s*ゲーム|PC\s*ゲーム|その他ゲーム|テーブルゲーム|シミュレーションゲーム|アドベンチャー|RPG|ゲーム/.test(
      t,
    )
  ) {
    return "game";
  }
  if (/CG|イラスト|3D\s*CG|CG集/.test(t)) return "cg";
  if (/動画|アニメ|ムービー|モーション|フィルム|映像/.test(t)) return "video";
  if (/コミック|漫画|電子コミック|デジタルコミック|マンガ/.test(t)) {
    return "comic";
  }
  if (/その他/.test(t)) return "other";
  return null;
}

function matchVolumeFormat(volume: string): DoujinProductFormat | null {
  const v = normalizeText(volume);
  if (!v) return null;

  if (/画像|枚|ページ/.test(v)) return "cg";
  if (/動画|分|本/.test(v)) return "video";
  if (/^\d{1,4}$/.test(v)) return "comic";
  return null;
}

function matchGenreFormat(genreNames: string[]): DoujinProductFormat | null {
  const joined = genreNames.map(normalizeText).filter(Boolean).join(" | ");
  if (!joined) return null;

  if (/ボイスコミック/.test(joined)) return "voice_comic";
  if (/デジタルノベル|(^|｜|\|)\s*ノベル\s*($|｜|\|)/.test(joined)) {
    return "novel";
  }
  if (/ASMR|音声付き/.test(joined)) return "audio";
  if (/その他ゲーム|テーブルゲーム/.test(joined)) return "game";
  if (/イラスト・CG集|3DCG/.test(joined)) return "cg";
  if (/動画・アニメーション|動画ファイル|動画配信/.test(joined)) return "video";
  return null;
}

export type DoujinProductFormatSource = {
  productFormat?: string | null;
  volume?: string | null;
  categoryName?: string | null;
  floorName?: string | null;
  genreNames?: string[] | null;
  title?: string | null;
  rawApiResponse?: Record<string, unknown> | null;
};

/**
 * 作品形式を正規化する。
 * 判定できない場合は null（誤分類を避ける。other へ強制しない）。
 */
export function normalizeDoujinProductFormat(
  source: DoujinProductFormatSource | string | null | undefined,
): DoujinProductFormat | null {
  if (source == null) return null;
  if (typeof source === "string") {
    return matchExplicitFormat(source);
  }

  const raw = source.rawApiResponse ?? undefined;
  const categoryFromRaw =
    typeof raw?.category_name === "string" ? raw.category_name : undefined;
  const floorFromRaw =
    typeof raw?.floor_name === "string" ? raw.floor_name : undefined;
  const volumeFromRaw =
    typeof raw?.volume === "string" ? raw.volume : undefined;

  const explicitCandidates = [
    source.productFormat,
    source.categoryName,
    categoryFromRaw,
    source.floorName,
    floorFromRaw,
  ];

  for (const candidate of explicitCandidates) {
    if (!candidate) continue;
    const matched = matchExplicitFormat(candidate);
    if (matched) return matched;
  }

  const volumeMatched = matchVolumeFormat(
    source.volume ?? volumeFromRaw ?? "",
  );
  if (volumeMatched) return volumeMatched;

  const genreMatched = matchGenreFormat(source.genreNames ?? []);
  if (genreMatched) return genreMatched;

  if (source.title) {
    const title = normalizeText(source.title);
    if (/ボイスコミック/.test(title)) return "voice_comic";
    if (/ASMR/.test(title)) return "audio";
    if (/シミュレータ|シミュレーター/.test(title)) return "game";
  }

  return null;
}

export function getDoujinProductFormatLabel(
  format?: DoujinProductFormat | string | null,
): string | undefined {
  if (!format) return undefined;
  if ((DOUJIN_PRODUCT_FORMATS as readonly string[]).includes(format)) {
    return DOUJIN_PRODUCT_FORMAT_LABELS[format as DoujinProductFormat];
  }
  const normalized = normalizeDoujinProductFormat(format);
  return normalized
    ? DOUJIN_PRODUCT_FORMAT_LABELS[normalized]
    : undefined;
}

export function getDoujinProductFormatStyle(
  format?: DoujinProductFormat | string | null,
): DoujinProductFormatStyle | undefined {
  if (!format) return undefined;
  if ((DOUJIN_PRODUCT_FORMATS as readonly string[]).includes(format)) {
    return DOUJIN_FORMAT_STYLES[format as DoujinProductFormat];
  }
  const normalized = normalizeDoujinProductFormat(format);
  return normalized ? DOUJIN_FORMAT_STYLES[normalized] : undefined;
}

export function isDoujinProductFormat(
  value?: string | null,
): value is DoujinProductFormat {
  return Boolean(
    value && (DOUJIN_PRODUCT_FORMATS as readonly string[]).includes(value),
  );
}

export function parseDoujinProductFormatParam(
  value?: string | null,
): DoujinProductFormat | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  if (isDoujinProductFormat(raw)) return raw;
  return normalizeDoujinProductFormat(raw);
}
