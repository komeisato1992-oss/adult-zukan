"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import {
  ActiveFilterChips,
  FilterChip,
  FilterTrigger,
  MultiSelectFilterPanel,
  SearchableOptionGrid,
  SingleSelectFilterPanel,
} from "@/components/works/filters/WorksFilterParts";
import {
  buildDoujinWorksFilterDraftFromQuery,
  DOUJIN_CIRCLE_PANEL_LIMIT,
  DOUJIN_PRICE_FILTER_OPTIONS,
  DOUJIN_RELEASE_FILTER_OPTIONS,
  type DoujinFilterOption,
  type DoujinPriceFilterKey,
  type DoujinReleaseFilterKey,
  type DoujinWorksFilterDraft,
  type DoujinWorksListQueryState,
} from "@/lib/doujin/list-filters";
import {
  DOUJIN_PRODUCT_FORMAT_LABELS,
  isDoujinProductFormat,
  type DoujinProductFormat,
} from "@/lib/doujin/product-format";
import { DoujinProductFormatBadge } from "@/components/doujin/DoujinProductFormatBadge";

export type DoujinWorksFilterPanelKey =
  | "genre"
  | "circle"
  | "format"
  | "price"
  | "date";

type DoujinWorksFiltersProps = {
  genreOptions: DoujinFilterOption[];
  circleOptions: DoujinFilterOption[];
  formatOptions: DoujinFilterOption[];
  yearOptions: string[];
  appliedQuery: DoujinWorksListQueryState;
  onApply: (draft: DoujinWorksFilterDraft, resetPage?: boolean) => void;
};

const PRICE_OPTIONS = DOUJIN_PRICE_FILTER_OPTIONS.filter(
  (option) => option.key !== "all",
);
const DATE_OPTIONS = DOUJIN_RELEASE_FILTER_OPTIONS.filter(
  (option) => option.key !== "all",
);

/**
 * アダルト図鑑 WorksFilters と同型の開閉パネルUI。
 * メーカー → サークルに差し替え。色は同人テーマの accent 変数を利用。
 */
export function DoujinWorksFilters({
  genreOptions,
  circleOptions,
  formatOptions,
  yearOptions,
  appliedQuery,
  onApply,
}: DoujinWorksFiltersProps) {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<DoujinWorksFilterPanelKey | null>(
    null,
  );
  const [draft, setDraft] = useState<DoujinWorksFilterDraft>(() =>
    buildDoujinWorksFilterDraftFromQuery(appliedQuery),
  );
  const [genreSearch, setGenreSearch] = useState("");
  const [circleSearch, setCircleSearch] = useState("");

  useEffect(() => {
    setDraft(buildDoujinWorksFilterDraftFromQuery(appliedQuery));
  }, [appliedQuery]);

  const togglePanel = useCallback((panel: DoujinWorksFilterPanelKey) => {
    setOpenPanel((current) => (current === panel ? null : panel));
    setGenreSearch("");
    setCircleSearch("");
  }, []);

  const closePanel = useCallback(() => {
    setOpenPanel(null);
    setGenreSearch("");
    setCircleSearch("");
  }, []);

  useEffect(() => {
    if (!openPanel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [closePanel, openPanel]);

  const applyDraft = useCallback(() => {
    onApply(draft, true);
    closePanel();
  }, [closePanel, draft, onApply]);

  const clearDraftPanel = useCallback(() => {
    if (openPanel === "genre") {
      setDraft((current) => ({ ...current, genres: [] }));
      setGenreSearch("");
      return;
    }
    if (openPanel === "circle") {
      setDraft((current) => ({ ...current, circles: [] }));
      setCircleSearch("");
      return;
    }
    if (openPanel === "format") {
      setDraft((current) => ({ ...current, format: "" }));
      return;
    }
    if (openPanel === "price") {
      setDraft((current) => ({ ...current, price: "all" }));
      return;
    }
    if (openPanel === "date") {
      setDraft((current) => ({ ...current, release: "all", year: "" }));
    }
  }, [openPanel]);

  const appliedDraft = useMemo(
    () => buildDoujinWorksFilterDraftFromQuery(appliedQuery),
    [appliedQuery],
  );

  const genreLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of genreOptions) map.set(option.value, option.label);
    return map;
  }, [genreOptions]);

  const circleLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of circleOptions) map.set(option.value, option.label);
    return map;
  }, [circleOptions]);

  const visibleCircleOptions = useMemo(() => {
    const keyword = circleSearch.trim().toLowerCase();
    const filtered = keyword
      ? circleOptions.filter((option) =>
          option.label.toLowerCase().includes(keyword),
        )
      : circleOptions;
    return filtered.slice(0, DOUJIN_CIRCLE_PANEL_LIMIT);
  }, [circleOptions, circleSearch]);

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> =
      [];

    for (const genreId of appliedDraft.genres) {
      chips.push({
        id: `genre-${genreId}`,
        label: genreLabelById.get(genreId) ?? genreId,
        onRemove: () => {
          onApply(
            {
              ...appliedDraft,
              genres: appliedDraft.genres.filter((value) => value !== genreId),
            },
            true,
          );
        },
      });
    }

    for (const circleId of appliedDraft.circles) {
      chips.push({
        id: `circle-${circleId}`,
        label: circleLabelById.get(circleId) ?? circleId,
        onRemove: () => {
          onApply(
            {
              ...appliedDraft,
              circles: appliedDraft.circles.filter(
                (value) => value !== circleId,
              ),
            },
            true,
          );
        },
      });
    }

    if (appliedDraft.format) {
      chips.push({
        id: `format-${appliedDraft.format}`,
        label:
          DOUJIN_PRODUCT_FORMAT_LABELS[appliedDraft.format] ??
          appliedDraft.format,
        onRemove: () => {
          onApply({ ...appliedDraft, format: "" }, true);
        },
      });
    }

    if (appliedDraft.price !== "all") {
      const priceLabel =
        DOUJIN_PRICE_FILTER_OPTIONS.find(
          (option) => option.key === appliedDraft.price,
        )?.label ?? appliedDraft.price;
      chips.push({
        id: `price-${appliedDraft.price}`,
        label: priceLabel,
        onRemove: () => {
          onApply({ ...appliedDraft, price: "all" }, true);
        },
      });
    }

    if (appliedDraft.year) {
      chips.push({
        id: `year-${appliedDraft.year}`,
        label: `${appliedDraft.year}年`,
        onRemove: () => {
          onApply({ ...appliedDraft, year: "" }, true);
        },
      });
    } else if (appliedDraft.release !== "all") {
      const dateLabel =
        DOUJIN_RELEASE_FILTER_OPTIONS.find(
          (option) => option.key === appliedDraft.release,
        )?.label ?? appliedDraft.release;
      chips.push({
        id: `release-${appliedDraft.release}`,
        label: dateLabel,
        onRemove: () => {
          onApply({ ...appliedDraft, release: "all" }, true);
        },
      });
    }

    return chips;
  }, [appliedDraft, circleLabelById, genreLabelById, onApply]);

  const clearAllApplied = useCallback(() => {
    onApply(
      {
        genres: [],
        circles: [],
        format: "",
        price: "all",
        release: "all",
        year: "",
      },
      true,
    );
  }, [onApply]);

  const toggleGenre = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      genres: current.genres.includes(value)
        ? current.genres.filter((genre) => genre !== value)
        : [...current.genres, value],
    }));
  }, []);

  const toggleCircle = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      circles: current.circles.includes(value)
        ? current.circles.filter((circle) => circle !== value)
        : [...current.circles, value],
    }));
  }, []);

  return (
    <div ref={containerRef} className="space-y-3">
      <WorksListControlGroup label="絞り込み">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:gap-3">
          <FilterTrigger
            label="ジャンル"
            count={appliedDraft.genres.length}
            isOpen={openPanel === "genre"}
            onClick={() => togglePanel("genre")}
          />
          <FilterTrigger
            label="サークル"
            count={appliedDraft.circles.length}
            isOpen={openPanel === "circle"}
            onClick={() => togglePanel("circle")}
          />
          <FilterTrigger
            label="作品形式"
            count={appliedDraft.format ? 1 : 0}
            isOpen={openPanel === "format"}
            onClick={() => togglePanel("format")}
          />
          <FilterTrigger
            label="価格帯"
            count={appliedDraft.price !== "all" ? 1 : 0}
            isOpen={openPanel === "price"}
            onClick={() => togglePanel("price")}
          />
          <FilterTrigger
            label="発売日"
            count={
              appliedDraft.release !== "all" || appliedDraft.year ? 1 : 0
            }
            isOpen={openPanel === "date"}
            onClick={() => togglePanel("date")}
          />
        </div>
      </WorksListControlGroup>

      {openPanel ? (
        <div
          id={`${panelId}-${openPanel}`}
          role="region"
          aria-label={`${openPanel}フィルター`}
        >
          {openPanel === "genre" ? (
            <MultiSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <SearchableOptionGrid
                options={genreOptions}
                selectedValues={draft.genres}
                onToggle={toggleGenre}
                searchPlaceholder="ジャンル名を検索"
                searchQuery={genreSearch}
                onSearchQueryChange={setGenreSearch}
              />
            </MultiSelectFilterPanel>
          ) : null}

          {openPanel === "circle" ? (
            <MultiSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <SearchableOptionGrid
                options={visibleCircleOptions}
                selectedValues={draft.circles}
                onToggle={toggleCircle}
                searchPlaceholder="サークル名を検索"
                searchQuery={circleSearch}
                onSearchQueryChange={setCircleSearch}
              />
            </MultiSelectFilterPanel>
          ) : null}

          {openPanel === "format" ? (
            <SingleSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <FilterChip
                  label={`すべて（${formatOptions.reduce((sum, option) => sum + (option.count ?? 0), 0).toLocaleString("ja-JP")}）`}
                  selected={!draft.format}
                  showCheck={false}
                  onClick={() =>
                    setDraft((current) => ({ ...current, format: "" }))
                  }
                />
                {formatOptions.map((option) => {
                  const format = isDoujinProductFormat(option.value)
                    ? (option.value as DoujinProductFormat)
                    : null;
                  const countLabel =
                    option.count != null
                      ? `（${option.count.toLocaleString("ja-JP")}）`
                      : "";
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          format:
                            current.format === option.value
                              ? ""
                              : ((option.value as DoujinProductFormat) || ""),
                        }))
                      }
                      className={`flex items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors ${
                        draft.format === option.value
                          ? "border-accent bg-accent-light"
                          : "border-border bg-white hover:border-accent/40"
                      }`}
                    >
                      {format ? (
                        <DoujinProductFormatBadge
                          normalizedFormat={format}
                          size="sm"
                        />
                      ) : (
                        <span>{option.label}</span>
                      )}
                      <span className="text-muted">{countLabel}</span>
                    </button>
                  );
                })}
              </div>
            </SingleSelectFilterPanel>
          ) : null}

          {openPanel === "price" ? (
            <SingleSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRICE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.key}
                    label={option.label}
                    selected={draft.price === option.key}
                    showCheck={false}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        price:
                          current.price === option.key
                            ? "all"
                            : (option.key as DoujinPriceFilterKey),
                      }))
                    }
                  />
                ))}
              </div>
            </SingleSelectFilterPanel>
          ) : null}

          {openPanel === "date" ? (
            <SingleSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DATE_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.key}
                      label={option.label}
                      selected={
                        !draft.year && draft.release === option.key
                      }
                      showCheck={false}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          year: "",
                          release:
                            !current.year && current.release === option.key
                              ? "all"
                              : (option.key as DoujinReleaseFilterKey),
                        }))
                      }
                    />
                  ))}
                </div>
                {yearOptions.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-foreground">
                      発売年指定
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {yearOptions.map((year) => (
                        <FilterChip
                          key={year}
                          label={`${year}年`}
                          selected={draft.year === year}
                          showCheck={false}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              release: "all",
                              year: current.year === year ? "" : year,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </SingleSelectFilterPanel>
          ) : null}
        </div>
      ) : null}

      <ActiveFilterChips chips={activeChips} onClearAll={clearAllApplied} />
    </div>
  );
}
