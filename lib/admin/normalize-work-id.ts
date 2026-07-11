/** 品番・ID比較用：大文字小文字・ハイフン等を正規化 */
export function normalizeWorkId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
