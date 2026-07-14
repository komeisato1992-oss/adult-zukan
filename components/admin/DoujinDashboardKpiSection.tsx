"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const MORE_KPI_KEY = "doujin-admin-dashboard-more-kpis";

type Kpi = { label: string; value: string; sub?: string };

type DoujinDashboardKpiSectionProps = {
  primary: Kpi[];
  secondary: Kpi[];
};

function KpiCard({ label, value, sub }: Kpi) {
  return (
    <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-border bg-white p-3 shadow-sm md:min-h-0 md:p-4">
      <p className="text-[12px] leading-tight text-muted md:text-xs">{label}</p>
      <div>
        <p className="mt-1 truncate text-[26px] font-bold leading-none tabular-nums md:text-2xl">
          {value}
        </p>
        {sub ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted md:text-xs">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DoujinDashboardKpiSection({
  primary,
  secondary,
}: DoujinDashboardKpiSectionProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(MORE_KPI_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MORE_KPI_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <section className="space-y-2.5 md:space-y-3">
      {/* スマホ: 2列 / PC: 既存の複数列 */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
        {primary.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* スマホのみ折りたたみ */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-lg border border-border bg-white text-sm font-medium text-foreground"
        >
          {open ? "その他の指標を閉じる" : "その他の指標を見る"}
        </button>
        {open ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {secondary.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
        ) : null}
      </div>

      {/* PC: 補助指標も常時表示 */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-4">
        {secondary.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
    </section>
  );
}
