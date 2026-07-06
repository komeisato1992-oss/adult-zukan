/** DMM APIの価格文字列を「¥2,680〜」形式に整形 */
export function formatDmmPriceString(price: string): string {
  const trimmed = price.trim();
  if (!trimmed) return trimmed;

  const hasRangeSuffix = /[~〜]$/.test(trimmed);
  const digits = trimmed.replace(/[^\d]/g, "");

  if (!digits) {
    return trimmed.replace(/~/g, "〜");
  }

  const formatted = `¥${Number(digits).toLocaleString("ja-JP")}`;
  return hasRangeSuffix ? `${formatted}〜` : formatted;
}

/** 「HD ¥3180」のような文字列内の金額を整形 */
export function formatDmmPriceText(text: string): string {
  return text
    .replace(/¥?(\d[\d,]*)/g, (_, digits: string) => {
      const normalized = digits.replace(/,/g, "");
      return `¥${Number(normalized).toLocaleString("ja-JP")}`;
    })
    .replace(/~/g, "〜");
}
