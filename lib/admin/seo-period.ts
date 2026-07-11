import type { SeoPeriodDays } from "@/lib/admin/seo-types";

export const SEO_PERIOD_OPTIONS: SeoPeriodDays[] = [7, 28, 90];

export function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

export type SeoDateRange = {
  startDate: string;
  endDate: string;
};

/** 直近 N 日（今日を含む） */
export function getCurrentPeriodRange(days: SeoPeriodDays, endDate = new Date()): SeoDateRange {
  const start = subtractDays(endDate, days - 1);
  return {
    startDate: formatDateUtc(start),
    endDate: formatDateUtc(endDate),
  };
}

/** その直前の同じ日数 */
export function getPreviousPeriodRange(days: SeoPeriodDays, endDate = new Date()): SeoDateRange {
  const currentStart = subtractDays(endDate, days - 1);
  const previousEnd = subtractDays(currentStart, 1);
  const previousStart = subtractDays(previousEnd, days - 1);
  return {
    startDate: formatDateUtc(previousStart),
    endDate: formatDateUtc(previousEnd),
  };
}

export function parseSeoPeriodDays(value: string | null | undefined): SeoPeriodDays {
  const parsed = Number.parseInt(value ?? "", 10);
  if (parsed === 7 || parsed === 28 || parsed === 90) {
    return parsed;
  }
  return 28;
}
