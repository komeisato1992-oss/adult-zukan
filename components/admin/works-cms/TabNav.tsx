"use client";

import {
  WORKS_CMS_TABS,
  type WorksCmsTabId,
} from "@/components/admin/works-cms/types";

type TabNavProps = {
  activeTab: WorksCmsTabId;
  onChange: (tab: WorksCmsTabId) => void;
  sticky?: boolean;
};

export function WorksCmsTabNav({
  activeTab,
  onChange,
  sticky = true,
}: TabNavProps) {
  return (
    <nav
      aria-label="作品管理タブ"
      className={`${
        sticky
          ? "sticky top-0 z-30 -mx-1 bg-zinc-50/95 px-1 py-2 backdrop-blur"
          : ""
      }`}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {WORKS_CMS_TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={active ? "page" : undefined}
              className={`min-h-[40px] shrink-0 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "border border-border bg-white text-foreground hover:bg-zinc-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
