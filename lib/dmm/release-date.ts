import type { DmmItem } from "@/lib/dmm/types";
import { formatDmmPriceString } from "@/lib/dmm/format-price";

export type DmmReleaseDateInfo = {
  label: "発売日" | "発売予定日";
  value: string;
};

export function getDmmReleaseDateInfo(
  item: DmmItem,
): DmmReleaseDateInfo | undefined {
  const raw = item.date?.trim();
  if (!raw) return undefined;

  const parsed = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return undefined;

  const value = `${parsed.getFullYear()}/${parsed.getMonth() + 1}/${parsed.getDate()}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const releaseDay = new Date(parsed);
  releaseDay.setHours(0, 0, 0, 0);

  const label = releaseDay > today ? "発売予定日" : "発売日";

  return { label, value };
}

export function isDmmFutureRelease(item: DmmItem): boolean {
  return getDmmReleaseDateInfo(item)?.label === "発売予定日";
}

export function formatDmmItemPrice(item: DmmItem): string | undefined {
  const price = item.prices?.price;
  if (!price) return undefined;
  return formatDmmPriceString(price);
}
