export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GA_ID?.trim() ||
  "";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname);
}

export function isAdminPathname(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith("/admin"));
}

export function shouldLoadGoogleAnalytics(options: {
  pathname: string | null | undefined;
  hostname?: string;
}): boolean {
  if (!isProductionEnvironment()) return false;
  if (!GA_MEASUREMENT_ID) return false;
  if (isAdminPathname(options.pathname)) return false;
  if (options.hostname && isLocalHostname(options.hostname)) return false;
  return true;
}

export function buildGaPagePath(
  pathname: string,
  searchParams?: URLSearchParams | null,
): string {
  const query = searchParams?.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function sendGaPageView(pagePath: string): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  if (!window.gtag) return;

  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: pagePath,
  });
}
