type SeoStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
};

export function SeoStatCard({
  label,
  value,
  hint,
  highlight = false,
}: SeoStatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-2 text-3xl font-bold ${
          highlight ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
