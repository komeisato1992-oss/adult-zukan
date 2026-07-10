import type { ReactNode } from "react";

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onClick: () => void;
  showCheck?: boolean;
};

export function FilterChip({
  label,
  selected = false,
  onClick,
  showCheck = true,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-[36px] items-center justify-center rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-sm ${
        selected
          ? "border-accent bg-accent-light text-accent"
          : "border-border bg-white text-foreground hover:border-accent/30 hover:bg-surface"
      }`}
    >
      {selected && showCheck ? <span className="mr-1">✓</span> : null}
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}

type FilterTriggerProps = {
  label: string;
  count?: number;
  isOpen?: boolean;
  onClick: () => void;
};

export function FilterTrigger({
  label,
  count = 0,
  isOpen = false,
  onClick,
}: FilterTriggerProps) {
  const displayLabel = count > 0 ? `${label}（${count}）` : label;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className={`inline-flex h-10 min-h-[44px] w-full items-center justify-between gap-2 rounded border bg-white px-3 text-sm text-foreground transition-colors sm:w-auto sm:min-w-[140px] ${
        isOpen
          ? "border-accent ring-2 ring-accent/20"
          : "border-border hover:border-accent/30"
      }`}
    >
      <span className="truncate">{displayLabel}</span>
      <span className="shrink-0 text-muted" aria-hidden>
        ▼
      </span>
    </button>
  );
}

type ActiveFilterChipsProps = {
  chips: Array<{
    id: string;
    label: string;
    onRemove: () => void;
  }>;
  onClearAll?: () => void;
};

export function ActiveFilterChips({ chips, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-border bg-surface px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-foreground">選択中：</span>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onRemove}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent-light px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
          >
            <span className="truncate">{chip.label}</span>
            <span aria-hidden>×</span>
          </button>
        ))}
        {onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-accent hover:underline"
          >
            すべてクリア
          </button>
        ) : null}
      </div>
    </div>
  );
}

type SearchableOptionGridProps = {
  options: Array<{ label: string; value: string; count?: number }>;
  selectedValues: string[];
  onToggle: (value: string) => void;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  emptyLabel?: string;
};

export function SearchableOptionGrid({
  options,
  selectedValues,
  onToggle,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange,
  emptyLabel = "該当する項目がありません。",
}: SearchableOptionGridProps) {
  const keyword = searchQuery.trim().toLowerCase();
  const visibleOptions = keyword
    ? options.filter((option) => option.label.toLowerCase().includes(keyword))
    : options;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder={searchPlaceholder}
        autoComplete="off"
        className="h-10 w-full rounded border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <div className="max-h-[360px] overflow-y-auto pr-1">
        {visibleOptions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={
                  option.count != null
                    ? `${option.label} (${option.count.toLocaleString("ja-JP")})`
                    : option.label
                }
                selected={selectedValues.includes(option.value)}
                onClick={() => onToggle(option.value)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type MultiSelectFilterPanelProps = {
  children: ReactNode;
  onClear: () => void;
  onApply: () => void;
};

export function MultiSelectFilterPanel({
  children,
  onClear,
  onApply,
}: MultiSelectFilterPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-sm sm:p-4">
      {children}
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          選択をクリア
        </button>
        <button
          type="button"
          onClick={onApply}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          この条件で検索
        </button>
      </div>
    </div>
  );
}

type SingleSelectFilterPanelProps = MultiSelectFilterPanelProps;

export function SingleSelectFilterPanel(props: SingleSelectFilterPanelProps) {
  return <MultiSelectFilterPanel {...props} />;
}
