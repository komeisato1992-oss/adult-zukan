/**
 * 同人作品形式の正規化（JS / バックフィル共用）
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
];

export const DOUJIN_PRODUCT_FORMAT_LABELS = {
  comic: "コミック",
  cg: "CG",
  video: "動画",
  audio: "音声",
  game: "ゲーム",
  voice_comic: "ボイスコミック",
  novel: "ノベル",
  other: "その他",
};

const AMBIGUOUS_FORMAT_PATTERN =
  /^(同人(\s*[（(]\s*同人\s*[）)])?|doujin)$/i;

function normalizeText(value) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function matchExplicitFormat(text) {
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

function matchVolumeFormat(volume) {
  const v = normalizeText(volume);
  if (!v) return null;
  if (/画像|枚|ページ/.test(v)) return "cg";
  if (/動画|分|本/.test(v)) return "video";
  if (/^\d{1,4}$/.test(v)) return "comic";
  return null;
}

function matchGenreFormat(genreNames) {
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

/**
 * @param {object|string|null|undefined} source
 * @returns {string|null}
 */
export function normalizeDoujinProductFormat(source) {
  if (source == null) return null;
  if (typeof source === "string") return matchExplicitFormat(source);

  const raw = source.rawApiResponse ?? undefined;
  const categoryFromRaw =
    typeof raw?.category_name === "string" ? raw.category_name : undefined;
  const floorFromRaw =
    typeof raw?.floor_name === "string" ? raw.floor_name : undefined;
  const volumeFromRaw =
    typeof raw?.volume === "string" ? raw.volume : undefined;

  for (const candidate of [
    source.productFormat,
    source.categoryName,
    categoryFromRaw,
    source.floorName,
    floorFromRaw,
  ]) {
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
