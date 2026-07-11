import type { SeoSitemapStatusSnapshot } from "@/lib/admin/seo-types";

export function countSubmittedSitemaps(
  snapshot: SeoSitemapStatusSnapshot,
): { submitted: number; total: number } {
  const total = snapshot.rows.length;
  const submitted = snapshot.rows.filter(
    (row) => row.status === "success",
  ).length;
  return { submitted, total };
}

export function formatSitemapKpiValue(snapshot: SeoSitemapStatusSnapshot): string {
  const { submitted, total } = countSubmittedSitemaps(snapshot);
  if (snapshot.fetchError && submitted === 0) return "—";
  return `送信済 ${submitted}/${total}`;
}
