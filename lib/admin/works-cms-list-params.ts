import type { PublishFilters } from "@/components/admin/works-cms/PublishTab";

export function buildWorksCmsListSearchParams(
  filters: PublishFilters,
  page = 1,
  pageSize = 40,
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters.title.trim()) params.set("q", filters.title.trim());
  if (filters.cid.trim()) params.set("cid", filters.cid.trim());
  if (filters.actress.trim()) params.set("actress", filters.actress.trim());
  if (filters.maker.trim()) params.set("maker", filters.maker.trim());
  if (filters.label.trim()) params.set("label", filters.label.trim());
  if (filters.series.trim()) params.set("series", filters.series.trim());
  if (filters.genre.trim()) params.set("genre", filters.genre.trim());

  if (filters.status === "published") params.set("published", "published");
  else if (filters.status === "unpublished")
    params.set("published", "unpublished");
  if (filters.status === "noImage") params.set("noImage", "1");
  if (filters.status === "unavailable") params.set("unavailable", "1");
  if (filters.status === "manualHidden") params.set("manualHidden", "1");
  if (filters.status === "fanzaActive") params.set("fanzaTv", "active");
  if (filters.status === "fanzaUnchecked") params.set("fanzaTv", "unchecked");

  return params;
}

export async function fetchAllFilteredWorksCmsCids(
  filters: PublishFilters,
): Promise<string[]> {
  const cids: string[] = [];
  let page = 1;
  const pageSize = 100;

  for (;;) {
    const params = buildWorksCmsListSearchParams(filters, page, pageSize);
    const res = await fetch(`/api/admin/works-cms/list?${params}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      success?: boolean;
      items?: Array<{ cid: string }>;
    };
    if (!data.success) break;

    const batch = data.items ?? [];
    if (batch.length === 0) break;

    cids.push(...batch.map((item) => item.cid));
    if (batch.length < pageSize) break;
    page += 1;
  }

  return [...new Set(cids)];
}
