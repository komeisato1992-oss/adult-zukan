"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  buildGaPagePath,
  GA_MEASUREMENT_ID,
  sendGaPageView,
  shouldLoadGoogleAnalytics,
} from "@/lib/gtag";

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isEnabled, setIsEnabled] = useState(false);
  const isFirstPageView = useRef(true);

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsEnabled(
      shouldLoadGoogleAnalytics({
        pathname,
        hostname,
      }),
    );
  }, [pathname]);

  useEffect(() => {
    if (!isEnabled) return;

    if (isFirstPageView.current) {
      isFirstPageView.current = false;
      return;
    }

    sendGaPageView(buildGaPagePath(pathname, searchParams));
  }, [pathname, searchParams, isEnabled]);

  if (!isEnabled || !GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
