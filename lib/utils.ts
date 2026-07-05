export const AFFILIATE_LINK_REL = "nofollow sponsored noopener noreferrer";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseDmmPrice(value?: string): number {
  if (!value) return 0;
  const parsed = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatReleaseDate(date?: string): string {
  if (!date) return "";
  return date.split(" ")[0] ?? date;
}
