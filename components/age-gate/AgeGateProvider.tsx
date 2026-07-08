"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AgeGateModal } from "@/components/age-gate/AgeGateModal";
import { isAgeVerified } from "@/lib/age-gate/storage";

const EXEMPT_PATH_PREFIXES = ["/age-denied", "/admin"];

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type AgeGateProviderProps = {
  children: React.ReactNode;
};

export function AgeGateProvider({ children }: AgeGateProviderProps) {
  const pathname = usePathname();
  const isExempt = isExemptPath(pathname);
  const [checked, setChecked] = useState(isExempt);
  const [verified, setVerified] = useState(isExempt);

  useEffect(() => {
    if (isExempt) {
      setChecked(true);
      setVerified(true);
      return;
    }

    setVerified(isAgeVerified());
    setChecked(true);
  }, [isExempt, pathname]);

  useEffect(() => {
    if (!checked || verified || isExempt) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [checked, verified, isExempt]);

  const showGate = checked && !verified && !isExempt;

  return (
    <>
      <div aria-hidden={showGate}>{children}</div>
      {showGate && <AgeGateModal onVerified={() => setVerified(true)} />}
    </>
  );
}
