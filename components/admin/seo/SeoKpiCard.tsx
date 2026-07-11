type SeoKpiCardProps = {
  label: string;
  value: string;
  changeLabel?: string;
  changeTone?: "up" | "down" | "neutral" | "none";
  hint?: string;
  subLabel?: string;
};

const TONE_CLASS: Record<NonNullable<SeoKpiCardProps["changeTone"]>, string> = {
  up: "text-green-600",
  down: "text-accent",
  neutral: "text-muted",
  none: "text-muted",
};

export function SeoKpiCard({
  label,
  value,
  changeLabel,
  changeTone = "none",
  hint,
  subLabel,
}: SeoKpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
      {changeLabel ? (
        <p className={`mt-2 text-xs font-medium ${TONE_CLASS[changeTone]}`}>
          {changeLabel}
        </p>
      ) : null}
      {subLabel ? <p className="mt-1 text-xs text-muted">{subLabel}</p> : null}
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
