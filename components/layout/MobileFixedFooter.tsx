"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { CompareMobileFooterBar } from "@/components/compare/CompareMobileFooterBar";
import { MobileBottomNavBar } from "@/components/layout/MobileBottomNavBar";
import { mobileBottomNavItems } from "@/lib/site-config";

function isNavItemActive(
  href: string,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/works") {
    return (
      pathname === "/works" &&
      !searchParams.get("q") &&
      !searchParams.get("sale") &&
      !searchParams.get("sort")
    );
  }

  const baseHref = href.split("?")[0];
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

export function MobileFixedFooter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur min-[769px]:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <CompareMobileFooterBar />
      <MobileBottomNavBar
        ariaLabel="アダルト図鑑下部ナビゲーション"
        items={mobileBottomNavItems}
        isActive={(href) => isNavItemActive(href, pathname, searchParams)}
      />
    </footer>
  );
}
