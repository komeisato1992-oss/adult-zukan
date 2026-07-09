/** カタカナをひらがなに変換（検索のゆらぎ吸収） */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

/**
 * 検索マッチ用に文字列を正規化する。
 * - NFKC（全角半角統一）
 * - 連続スペースを1つに
 * - 英字小文字化 + カタカナ→ひらがな
 * - 記号・スペース除去（文字と数字のみ残す）
 */
export function normalizeSearchText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  let normalized = trimmed.normalize("NFKC");
  normalized = normalized.replace(/[\s\u3000]+/g, " ");
  normalized = katakanaToHiragana(normalized.toLowerCase());
  normalized = normalized.replace(/[^\p{L}\p{N}]+/gu, "");

  return normalized;
}
