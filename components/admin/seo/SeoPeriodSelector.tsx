"use client";

import type { SeoPeriodDays } from "@/lib/admin/seo-types";
import { SEO_PERIOD_OPTIONS } from "@/lib/admin/seo-period";

type SeoPeriodSelectorProps = {
  value: SeoPeriodDays;
  onChange: (period: SeoPeriodDays) => void;
};

export function SeoPeriodSelector({ value, onChange }: SeoPeriodSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SEO_PERIOD_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`min-h-[44px] rounded-full border px-4 py-2 text-sm ${
            value === option
              ? "border-accent bg-accent text-white"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          {option}日
        </button>
      ))}
    </div>
  );
}
