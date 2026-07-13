"use client";

import { usePathname } from "next/navigation";
import { CompareCandidateGuide } from "@/components/compare/CompareCandidateGuide";
import { CompareFloatingButton } from "@/components/compare/CompareFloatingButton";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <CompareFloatingButton />
      <CompareCandidateGuide />
      <Footer />
    </>
  );
}
