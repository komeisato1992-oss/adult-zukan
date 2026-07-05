"use client";

import { useEffect } from "react";
import { addToHistory } from "@/lib/client-storage";

type HistoryTrackerProps = {
  slug: string;
  title: string;
  productCode: string;
};

export function HistoryTracker({ slug, title, productCode }: HistoryTrackerProps) {
  useEffect(() => {
    addToHistory({ slug, title, productCode });
  }, [slug, title, productCode]);

  return null;
}
