import type {
  DmmAffiliateMetrics,
  DmmTypeBreakdownRow,
} from "@/lib/admin/dmm-report-types";

export function buildTypeBreakdown(
  metrics: DmmAffiliateMetrics,
): DmmTypeBreakdownRow[] {
  return [
    {
      type: "category",
      label: "カテゴリ",
      count: metrics.categoryCount,
      sales: metrics.categorySales,
      reward: metrics.categoryReward,
      avgReward:
        metrics.categoryCount > 0
          ? metrics.categoryReward / metrics.categoryCount
          : 0,
    },
    {
      type: "direct",
      label: "ダイレクト",
      count: metrics.directCount,
      sales: metrics.directSales,
      reward: metrics.directReward,
      avgReward:
        metrics.directCount > 0
          ? metrics.directReward / metrics.directCount
          : 0,
    },
  ];
}
