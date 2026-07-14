export type AdminSite = "adult" | "doujin";

export const ADMIN_SITE_STORAGE_KEY = "adult-zukan-admin-site";

export function parseAdminSite(
  value: string | null | undefined,
): AdminSite {
  return value === "doujin" ? "doujin" : "adult";
}

/** pathname から管理対象サイトを推定（URL優先） */
export function adminSiteFromPathname(pathname: string): AdminSite {
  if (pathname === "/admin/doujin" || pathname.startsWith("/admin/doujin/")) {
    return "doujin";
  }
  return "adult";
}

export function adminSiteHomeHref(site: AdminSite): string {
  return site === "doujin" ? "/admin/doujin" : "/admin";
}

export function withAdminSiteParam(
  href: string,
  site: AdminSite,
): string {
  if (site === "adult") return href;
  if (href.startsWith("/admin/doujin")) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("site", "doujin");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
