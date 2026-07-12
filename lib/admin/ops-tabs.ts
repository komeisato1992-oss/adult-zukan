export const OPS_TAB_IDS = [
  "overview",
  "search-console",
  "ga4",
  "dmm",
] as const;

export type OpsTabId = (typeof OPS_TAB_IDS)[number];

export const OPS_TAB_ITEMS: Array<{ id: OpsTabId; label: string }> = [
  { id: "overview", label: "ダッシュボードTOP" },
  { id: "search-console", label: "Search Console" },
  { id: "ga4", label: "GA4" },
  { id: "dmm", label: "DMM" },
];

export function parseOpsTab(value: string | null | undefined): OpsTabId {
  if (
    value === "overview" ||
    value === "search-console" ||
    value === "ga4" ||
    value === "dmm"
  ) {
    return value;
  }
  return "overview";
}

export function opsTabHref(tab: OpsTabId): string {
  return tab === "overview" ? "/admin" : `/admin?tab=${tab}`;
}
