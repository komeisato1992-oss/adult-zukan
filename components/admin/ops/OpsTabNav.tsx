"use client";

import Link from "next/link";
import {
  OPS_TAB_ITEMS,
  opsTabHref,
  type OpsTabId,
} from "@/lib/admin/ops-tabs";

type OpsTabNavProps = {
  activeTab: OpsTabId;
  onChange: (tab: OpsTabId) => void;
};

export function OpsTabNav({ activeTab, onChange }: OpsTabNavProps) {
  return (
    <nav
      aria-label="運営ダッシュボードタブ"
      className="-mx-1 overflow-x-auto px-1"
    >
      <div className="flex min-w-max gap-2 pb-1">
        {OPS_TAB_ITEMS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={opsTabHref(tab.id)}
              onClick={(event) => {
                event.preventDefault();
                onChange(tab.id);
              }}
              className={`shrink-0 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-white text-foreground hover:border-red-200 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
