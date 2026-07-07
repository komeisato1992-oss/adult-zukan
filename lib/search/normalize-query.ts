/** 全角/半角スペースをトリムし、小文字化 */
export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim().replace(/[\s\u3000]+/g, " ");
  if (!trimmed) return "";
  return katakanaToHiragana(trimmed.toLowerCase());
}

/** カタカナをひらがなに変換（検索のゆらぎ吸収） */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}
