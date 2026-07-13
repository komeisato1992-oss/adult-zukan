import {
  getDoujinProductFormatLabel,
  getDoujinProductFormatStyle,
  isDoujinProductFormat,
  normalizeDoujinProductFormat,
  type DoujinProductFormat,
} from "@/lib/doujin/product-format";

type DoujinProductFormatBadgeProps = {
  format?: string | null;
  /** 正規化済みキー優先。未指定時は format を正規化する */
  normalizedFormat?: DoujinProductFormat | string | null;
  size?: "sm" | "md";
  className?: string;
};

/**
 * 同人作品の形式ラベル（コミック / CG / 動画 等）。
 * format が不明・空・曖昧な場合は何も出さない。
 */
export function DoujinProductFormatBadge({
  format,
  normalizedFormat,
  size = "sm",
  className = "",
}: DoujinProductFormatBadgeProps) {
  const resolved: DoujinProductFormat | null = isDoujinProductFormat(
    normalizedFormat,
  )
    ? normalizedFormat
    : normalizeDoujinProductFormat(normalizedFormat ?? format);

  if (!resolved) return null;

  const label = getDoujinProductFormatLabel(resolved);
  const style = getDoujinProductFormatStyle(resolved);
  if (!label || !style) return null;

  const sizeClass =
    size === "md"
      ? "px-2.5 py-1 text-xs sm:text-[13px]"
      : "px-2 py-1 text-[10px] sm:text-[11px]";

  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center truncate rounded-[3px] border font-medium leading-none ${sizeClass} ${className}`}
      style={{
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
      }}
    >
      {label}
    </span>
  );
}
