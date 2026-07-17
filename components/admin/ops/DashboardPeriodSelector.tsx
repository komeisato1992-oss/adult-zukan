"use client";

type DashboardPeriodSelectorProps<T extends string> = {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

export function DashboardPeriodSelector<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = "期間切り替え",
}: DashboardPeriodSelectorProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface p-1"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition ${
              active
                ? "bg-accent text-white shadow-sm"
                : "bg-transparent text-muted hover:bg-white hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
