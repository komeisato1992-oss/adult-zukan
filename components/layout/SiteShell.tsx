"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CompareCandidateGuide } from "@/components/compare/CompareCandidateGuide";
import { CompareFloatingButton } from "@/components/compare/CompareFloatingButton";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileFixedFooter } from "@/components/layout/MobileFixedFooter";

const BARE_PATH_PREFIXES = ["/age-denied", "/admin", "/doujin"];

function isBarePath(pathname: string): boolean {
  return BARE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type SiteShellProps = {
  children: React.ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();
  const isBare = isBarePath(pathname);
  const isCompareRoot = pathname === "/compare";

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main
        className={
          isCompareRoot
            ? "flex-1 max-[768px]:pb-[calc(56px+env(safe-area-inset-bottom,0px))]"
            : "flex-1 max-[768px]:pb-[calc(98px+env(safe-area-inset-bottom,0px))]"
        }
      >
        {children}
      </main>
      {isCompareRoot ? null : <CompareFloatingButton />}
      <CompareCandidateGuide />
      <Footer />
      <Suspense fallback={null}>
        <MobileFixedFooter />
      </Suspense>
    </>
  );
}
