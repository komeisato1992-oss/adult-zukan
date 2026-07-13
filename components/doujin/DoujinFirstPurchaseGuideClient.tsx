"use client";

import { useEffect, useRef } from "react";
import { sendGaEvent } from "@/lib/gtag";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type DoujinFirstPurchaseGuideTrackerProps = {
  workId: string;
  title: string;
  children: React.ReactNode;
};

const AFFILIATE_SERVICE = "fanza";

/** guide_open / FANZAクリック計測 */
export function DoujinFirstPurchaseGuideTracker({
  workId,
  title,
  children,
}: DoujinFirstPurchaseGuideTrackerProps) {
  useEffect(() => {
    sendGaEvent("guide_open", {
      workId,
      title,
      affiliateService: AFFILIATE_SERVICE,
    });
  }, [workId, title]);

  return (
    <div
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest("a[data-guide-fanza]");
        if (!anchor) return;
        sendGaEvent("guide_click_fanza", {
          workId,
          title,
          affiliateService: AFFILIATE_SERVICE,
        });
      }}
    >
      {children}
    </div>
  );
}

type DoujinFanzaGuideButtonProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function DoujinFanzaGuideButton({
  href,
  className = "",
  children,
}: DoujinFanzaGuideButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel={AFFILIATE_LINK_REL}
      data-guide-fanza="1"
      className={className}
    >
      {children}
    </a>
  );
}

type DoujinGuideStepProps = {
  stepNumber: number;
  stepName: string;
  workId: string;
  children: React.ReactNode;
  className?: string;
};

/** ステップが画面に入ったとき guide_step_visible を1回送信 */
export function DoujinGuideStep({
  stepNumber,
  stepName,
  workId,
  children,
  className = "",
}: DoujinGuideStepProps) {
  const ref = useRef<HTMLLIElement>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || sentRef.current) return;
        sentRef.current = true;
        sendGaEvent("guide_step_visible", {
          step_number: stepNumber,
          step_name: stepName,
          work_id: workId,
        });
      },
      { threshold: 0.35 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stepNumber, stepName, workId]);

  return (
    <li ref={ref} className={className}>
      {children}
    </li>
  );
}
